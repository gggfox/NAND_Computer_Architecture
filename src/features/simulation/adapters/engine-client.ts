import { FromEngineSchema } from "../domain/protocol";
import type { FromEngine, ToEngine } from "../domain/protocol";

/** The worker could not be started, crashed, or sent a reply that could not be read. */
export interface WorkerFailure {
  readonly type: "WorkerFailed";
}

/** What a client delivers: every validated worker reply plus a synthetic failure event. */
export type EngineEvent = FromEngine | { readonly type: "error"; readonly error: WorkerFailure };

export type EngineEventError = Extract<EngineEvent, { type: "error" }>["error"];

type Listener = (event: EngineEvent) => void;

export interface EngineClient {
  readonly send: (msg: ToEngine) => void;
  readonly subscribe: (listener: Listener) => () => void;
  readonly dispose: () => void;
}

const WORKER_FAILED: EngineEvent = { type: "error", error: { type: "WorkerFailed" } };

const startWorker = (): Worker | undefined => {
  try {
    // Vite bundles workers only from this exact `new Worker(new URL("./…", import.meta.url))` shape.
    /* oxlint-disable-next-line unicorn/relative-url-style -- keep the explicit `./` Vite's worker detection documents */
    return new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
  } catch {
    // Workers can be blocked (CSP, unsupported environment); the client then reports WorkerFailed.
    return undefined;
  }
};

/** Attaches the worker listeners and returns the function that detaches them. */
const attach = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- a Worker is a mutable DOM handle
  worker: Worker | undefined,
  onMessage: (event: MessageEvent<unknown>) => void,
  onFailure: () => void,
): (() => void) => {
  worker?.addEventListener("message", onMessage);
  worker?.addEventListener("error", onFailure);
  worker?.addEventListener("messageerror", onFailure);
  return () => {
    worker?.removeEventListener("message", onMessage);
    worker?.removeEventListener("error", onFailure);
    worker?.removeEventListener("messageerror", onFailure);
  };
};

/**
 * Main-thread handle to the engine worker (ADR 12). Replies are validated before delivery.
 * A worker that fails to start, throws (`error`) or sends a reply that cannot be deserialized or validated
 * (`messageerror`) is reported as a `WorkerFailed` error event instead of leaving the UI waiting.
 */
export const createEngineClient = (): EngineClient => {
  const worker = startWorker();
  const listeners = new Set<Listener>();
  let failed = worker === undefined;

  const emit = (event: EngineEvent): void => {
    for (const listener of listeners) {
      listener(event);
    }
  };
  const fail = (): void => {
    failed = true;
    emit(WORKER_FAILED);
  };
  const onMessage = (event: MessageEvent<unknown>): void => {
    const parsed = FromEngineSchema.safeParse(event.data);
    if (parsed.success) {
      emit(parsed.data);
      return;
    }
    console.error("engine worker sent an invalid message", parsed.error);
    fail();
  };
  const detach = attach(worker, onMessage, fail);

  return {
    send: (msg) => {
      if (failed || worker === undefined) {
        // Answer asynchronously, like a real reply, so callers see one consistent event order.
        queueMicrotask(() => {
          emit(WORKER_FAILED);
        });
        return;
      }
      /* oxlint-disable-next-line unicorn/require-post-message-target-origin -- Worker.postMessage has no targetOrigin */
      worker.postMessage(msg);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose: () => {
      detach();
      worker?.terminate();
      listeners.clear();
    },
  };
};
