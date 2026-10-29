import { createEngine } from "./engine";
import type { Engine, SettleResult } from "./engine";
import { compileNetlist } from "./netlist";
import { ToEngineSchema } from "./protocol";
import type { FromEngine, ToEngine } from "./protocol";

/** Tick budget for the settle that follows every `load` and `setInput`. */
export const SETTLE_TICKS = 1000;

const BAD_MESSAGE: FromEngine = { type: "error", error: { type: "BadMessage" } };

export interface EngineSession {
  /** Validates one untrusted message, applies it and returns the reply. */
  readonly handle: (raw: unknown) => FromEngine;
}

interface Loaded {
  readonly engine: Engine;
  readonly outputCount: number;
}

type LoadMessage = Extract<ToEngine, { type: "load" }>;
type SetInputMessage = Extract<ToEngine, { type: "setInput" }>;

const snapshot = ({ engine, outputCount }: Loaded, settled: SettleResult): FromEngine => ({
  type: "state",
  tick: engine.tickCount,
  stable: settled.stable,
  outputs: Array.from({ length: outputCount }, (_unused, index) => engine.readOutput(index)),
});

/** The worker's logic, kept pure so it is unit-tested; the worker itself only moves messages. */
export const createEngineSession = (): EngineSession => {
  let loaded: Loaded | undefined = undefined;

  const load = ({ source, seed }: LoadMessage): FromEngine => {
    const compiled = compileNetlist(source);
    if (!compiled.ok) {
      loaded = undefined;
      return { type: "error", error: compiled.error };
    }
    loaded = { engine: createEngine(compiled.value, seed), outputCount: source.outputs.length };
    return snapshot(loaded, loaded.engine.runUntilStable(SETTLE_TICKS));
  };

  const settle = (maxTicks: number, input?: SetInputMessage): FromEngine => {
    if (loaded === undefined) {
      return BAD_MESSAGE;
    }
    if (input !== undefined) {
      loaded.engine.setInput(input.index, input.value);
    }
    return snapshot(loaded, loaded.engine.runUntilStable(maxTicks));
  };

  const apply = (message: ToEngine): FromEngine => {
    if (message.type === "load") {
      return load(message);
    }
    return message.type === "setInput" ? settle(SETTLE_TICKS, message) : settle(message.maxTicks);
  };

  return {
    handle: (raw) => {
      const parsed = ToEngineSchema.safeParse(raw);
      return parsed.success ? apply(parsed.data) : BAD_MESSAGE;
    },
  };
};
