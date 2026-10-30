import { CLOCK_BATCH_MS } from "../domain/clock";
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

/**
 * Moves messages between the owner and the session, and drives the clock run loop. The worker
 * supplies wall-clock time; the session decides how many steps that is. The interval exists
 * exactly while the last posted reply says the clock is running.
 */
const serve = (scope: WorkerScope): void => {
  const session = createEngineSession();
  let timer: ReturnType<typeof setInterval> | undefined = undefined;
  let last = 0;

  const send = (reply: FromEngine): void => {
    /* oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker posts to its owner; there is no targetOrigin */
    scope.postMessage(reply);
  };
  const onBatch = (): void => {
    const now = performance.now();
    const reply = session.advance(now - last);
    last = now;
    if (reply !== undefined) {
      send(reply);
    }
  };
  const post = (reply: FromEngine): void => {
    send(reply);
    const running = reply.type === "state" && reply.running;
    if (running && timer === undefined) {
      last = performance.now();
      timer = setInterval(onBatch, CLOCK_BATCH_MS);
    } else if (!running) {
      clearInterval(timer);
      timer = undefined;
    }
  };

  scope.addEventListener("message", (event) => {
    post(session.handle(event.data));
  });
};

serve(globalThis);
