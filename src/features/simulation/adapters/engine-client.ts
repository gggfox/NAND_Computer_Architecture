import { FromEngineSchema } from "../domain/protocol";
import type { FromEngine, ToEngine } from "../domain/protocol";

type Listener = (msg: FromEngine) => void;

export interface EngineClient {
  readonly send: (msg: ToEngine) => void;
  readonly subscribe: (listener: Listener) => () => void;
  readonly dispose: () => void;
}

/** Main-thread handle to the engine worker (ADR 12). Replies are validated before delivery. */
export const createEngineClient = (): EngineClient => {
  // Vite bundles workers only from this exact `new Worker(new URL("./…", import.meta.url))` shape.
  /* oxlint-disable-next-line unicorn/relative-url-style -- keep the explicit `./` Vite's worker detection documents */
  const worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
  const listeners = new Set<Listener>();

  const onMessage = (event: MessageEvent<unknown>): void => {
    const parsed = FromEngineSchema.safeParse(event.data);
    if (!parsed.success) {
      console.error("engine worker sent an invalid message", parsed.error);
      return;
    }
    for (const listener of listeners) {
      listener(parsed.data);
    }
  };
  worker.addEventListener("message", onMessage);

  return {
    send: (msg) => {
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
      worker.removeEventListener("message", onMessage);
      worker.terminate();
      listeners.clear();
    },
  };
};
