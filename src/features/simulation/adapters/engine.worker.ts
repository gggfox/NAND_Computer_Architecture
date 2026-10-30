import type { FromEngine } from "../domain/protocol";
import { createEngineSession } from "../domain/session";

/**
 * The slice of `DedicatedWorkerGlobalScope` this worker uses. The project compiles with the DOM
 * lib (the WebWorker lib's globals conflict with it), and `globalThis` is structurally assignable
 * to this narrow interface, so neither a cast nor a second tsconfig is needed.
 */
interface WorkerScope {
  readonly addEventListener: (
    type: "message",
    listener: (event: MessageEvent<unknown>) => void,
  ) => void;
  readonly postMessage: (message: FromEngine) => void;
}

const scope: WorkerScope = globalThis;
const session = createEngineSession();

scope.addEventListener("message", (event) => {
  /* oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker posts to its owner; there is no targetOrigin */
  scope.postMessage(session.handle(event.data));
});
