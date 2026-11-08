import { err } from "~/shared/result";
import type { Result } from "~/shared/result";

import { DEFAULT_STEPS_PER_SECOND, stepsDue } from "./clock";
import { createEngine } from "./engine";
import type { Engine } from "./engine";
import { compileNetlist } from "./netlist";
import type { Netlist } from "./netlist";
import { exceedsWorkBudget, ToEngineSchema } from "./protocol";
import type { FromEngine, ToEngine } from "./protocol";

type EngineError = Extract<FromEngine, { type: "error" }>["error"];

/** Tick budget for the settle that follows every `load`, `setInput` and clock step. */
export const SETTLE_TICKS = 1000;

const BAD_MESSAGE: FromEngine = { type: "error", error: { type: "BadMessage" } };
const WORK_BUDGET_EXCEEDED: FromEngine = { type: "error", error: { type: "WorkBudgetExceeded" } };

export interface EngineSession {
  /** Validates one untrusted message, applies it and returns the reply. */
  readonly handle: (raw: unknown) => FromEngine;
  /**
   * Runs the clock steps due after `elapsedMs` of wall-clock time (supplied by the worker).
   * Returns `undefined` when not running, not loaded, or no step is due.
   */
  readonly advance: (elapsedMs: number) => FromEngine | undefined;
}

/** One loaded netlist: its engine plus the clock level and last settle result. */
interface LoadedNetlist {
  readonly setInput: (index: number, value: 0 | 1) => void;
  readonly settle: (maxTicks: number) => void;
  /** One step is half a clock cycle: toggle the clock, then settle. */
  readonly runSteps: (count: number) => void;
  readonly snapshot: (running: boolean) => FromEngine;
  readonly inputCount: number;
  /** True when settling `maxTicks` ticks would be more work than the budget allows. */
  readonly overBudget: (maxTicks: number) => boolean;
}

/** Run state that outlives a reload, so a reload while playing keeps playing at the same speed. */
interface RunClock {
  readonly running: () => boolean;
  readonly setRunning: (running: boolean) => void;
  readonly setSpeed: (stepsPerSecond: number) => void;
  readonly resetCarry: () => void;
  /** Whole steps due after `elapsedMs`; always 0 while paused. */
  readonly due: (elapsedMs: number) => number;
}

type LoadMessage = Extract<ToEngine, { type: "load" }>;
type ControlMessage = Exclude<ToEngine, LoadMessage>;

/** A fresh engine starts with the clock low. */
const loadNetlist = (
  engine: Engine,
  { inputCount, nandCount }: Netlist,
  outputCount: number,
): LoadedNetlist => {
  let clock: 0 | 1 = 0;
  let stable = true;
  const settle = (maxTicks: number): void => {
    ({ stable } = engine.runUntilStable(maxTicks));
  };
  return {
    setInput: (index, value) => {
      engine.setInput(index, value);
      settle(SETTLE_TICKS);
    },
    settle,
    runSteps: (count) => {
      for (let step = 0; step < count; step += 1) {
        clock = clock === 0 ? 1 : 0;
        engine.setClock(clock);
        settle(SETTLE_TICKS);
      }
    },
    inputCount,
    overBudget: (maxTicks) => exceedsWorkBudget(maxTicks, nandCount),
    snapshot: (running) => ({
      type: "state",
      tick: engine.tickCount,
      stable,
      outputs: Array.from({ length: outputCount }, (_unused, index) => engine.readOutput(index)),
      clock,
      running,
    }),
  };
};

const createRunClock = (): RunClock => {
  let running = false;
  let stepsPerSecond = DEFAULT_STEPS_PER_SECOND;
  let carrySteps = 0;
  return {
    running: () => running,
    setRunning: (next) => {
      running = next;
    },
    setSpeed: (next) => {
      stepsPerSecond = next;
    },
    resetCarry: () => {
      carrySteps = 0;
    },
    due: (elapsedMs) => {
      if (!running) {
        return 0;
      }
      const due = stepsDue(carrySteps, elapsedMs, stepsPerSecond);
      ({ carrySteps } = due);
      return due.steps;
    },
  };
};

/** Applies a non-`load` message to a loaded netlist. */
const control = (loaded: LoadedNetlist, run: RunClock, message: ControlMessage): void => {
  switch (message.type) {
    case "setInput": {
      loaded.setInput(message.index, message.value);
      return;
    }
    case "settle": {
      loaded.settle(message.maxTicks);
      return;
    }
    case "step": {
      loaded.runSteps(1);
      return;
    }
    case "setSpeed": {
      run.setSpeed(message.stepsPerSecond);
      return;
    }
    case "play":
    case "pause": {
      run.setRunning(message.type === "play");
    }
  }
};

const advanceLoaded = (
  loaded: LoadedNetlist,
  run: RunClock,
  elapsedMs: number,
): FromEngine | undefined => {
  const steps = run.due(elapsedMs);
  loaded.runSteps(steps);
  return steps > 0 ? loaded.snapshot(run.running()) : undefined;
};

/** Compiles a source and refuses one whose load-time settle is more work than the budget. */
const compileWithinBudget = (source: LoadMessage["source"]): Result<Netlist, EngineError> => {
  const compiled = compileNetlist(source);
  return compiled.ok && exceedsWorkBudget(SETTLE_TICKS, compiled.value.nandCount)
    ? err({ type: "WorkBudgetExceeded" })
    : compiled;
};

/** The reply that refuses a control message the loaded netlist cannot take, if any. */
const refuse = (loaded: LoadedNetlist, message: ControlMessage): FromEngine | undefined => {
  if (message.type === "setInput" && message.index >= loaded.inputCount) {
    return BAD_MESSAGE;
  }
  return message.type === "settle" && loaded.overBudget(message.maxTicks)
    ? WORK_BUDGET_EXCEEDED
    : undefined;
};

/** The worker's logic, kept pure so it is unit-tested; the worker only moves messages and time. */
export const createEngineSession = (): EngineSession => {
  let loaded: LoadedNetlist | undefined = undefined;
  const run = createRunClock();

  const load = ({ source, seed }: LoadMessage): FromEngine => {
    const compiled = compileWithinBudget(source);
    if (!compiled.ok) {
      loaded = undefined;
      return { type: "error", error: compiled.error };
    }
    loaded = loadNetlist(createEngine(compiled.value, seed), compiled.value, source.outputs.length);
    run.resetCarry();
    loaded.settle(SETTLE_TICKS);
    return loaded.snapshot(run.running());
  };

  const apply = (message: ToEngine): FromEngine => {
    if (message.type === "load") {
      return load(message);
    }
    const refusal = loaded && refuse(loaded, message);
    if (loaded === undefined || refusal !== undefined) {
      return refusal ?? BAD_MESSAGE;
    }
    control(loaded, run, message);
    return loaded.snapshot(run.running());
  };

  return {
    handle: (raw) => {
      const parsed = ToEngineSchema.safeParse(raw);
      return parsed.success ? apply(parsed.data) : BAD_MESSAGE;
    },
    advance: (elapsedMs) =>
      loaded === undefined ? undefined : advanceLoaded(loaded, run, elapsedMs),
  };
};
