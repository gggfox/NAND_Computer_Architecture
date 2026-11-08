import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ToEngine } from "../domain/protocol";
import { createEngineClient } from "./engine-client";
import type { EngineEvent } from "./engine-client";

type Handler = (event: unknown) => void;

/** A minimal Worker stand-in: records listeners and posted messages, and can fire events. */
class FakeWorker {
  static instances: FakeWorker[] = [];
  readonly listeners = new Map<string, Set<Handler>>();
  readonly posted: unknown[] = [];
  terminated = false;

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, handler: Handler): void {
    const handlers = this.listeners.get(type) ?? new Set<Handler>();
    handlers.add(handler);
    this.listeners.set(type, handlers);
  }

  removeEventListener(type: string, handler: Handler): void {
    this.listeners.get(type)?.delete(handler);
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  fire(type: string, event: unknown = {}): void {
    for (const handler of this.listeners.get(type) ?? []) {
      handler(event);
    }
  }
}

const WORKER_FAILED: EngineEvent = { type: "error", error: { type: "WorkerFailed" } };
const PLAY: ToEngine = { type: "play" };
const validReply = {
  type: "state",
  tick: 3,
  stable: true,
  outputs: [1, 0],
  clock: 0,
  running: false,
};

const setup = () => {
  const client = createEngineClient();
  const events: EngineEvent[] = [];
  client.subscribe((event) => {
    events.push(event);
  });
  const [worker] = FakeWorker.instances;
  if (worker === undefined) {
    throw new Error("the client did not start a worker");
  }
  return { client, events, worker };
};

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("engine client", () => {
  it("posts messages to the worker and delivers a valid reply", () => {
    const { client, events, worker } = setup();
    client.send(PLAY);
    worker.fire("message", { data: validReply });
    expect(worker.posted).toEqual([PLAY]);
    expect(events).toEqual([validReply]);
  });

  it("reports WorkerFailed on a worker error event", () => {
    const { events, worker } = setup();
    worker.fire("error");
    expect(events).toEqual([WORKER_FAILED]);
  });

  it("reports WorkerFailed on a messageerror event", () => {
    const { events, worker } = setup();
    worker.fire("messageerror");
    expect(events).toEqual([WORKER_FAILED]);
  });
});

describe("engine client failures", () => {
  it("logs and reports WorkerFailed for a reply that fails validation", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { events, worker } = setup();
    worker.fire("message", { data: { type: "state", tick: -1 } });
    expect(events).toEqual([WORKER_FAILED]);
    expect(logged).toHaveBeenCalledOnce();
  });

  it("answers a send after a failure with WorkerFailed and does not post", async () => {
    const { client, events, worker } = setup();
    worker.fire("error");
    events.length = 0;
    client.send(PLAY);
    expect(events).toEqual([]);
    await Promise.resolve();
    expect(events).toEqual([WORKER_FAILED]);
    expect(worker.posted).toEqual([]);
  });

  it("reports WorkerFailed on send when the worker cannot be created", async () => {
    vi.stubGlobal(
      "Worker",
      /* oxlint-disable-next-line prefer-arrow-callback -- `new` needs a constructible function; arrows cannot be constructed */
      vi.fn(function blocked() {
        throw new Error("blocked by CSP");
      }),
    );
    const client = createEngineClient();
    const events: EngineEvent[] = [];
    client.subscribe((event) => {
      events.push(event);
    });
    client.send(PLAY);
    await Promise.resolve();
    expect(events).toEqual([WORKER_FAILED]);
  });
});

describe("engine client lifecycle", () => {
  it("stops delivering after unsubscribe", () => {
    const { client, worker } = setup();
    const extra: EngineEvent[] = [];
    client.subscribe((event) => {
      extra.push(event);
    })();
    worker.fire("message", { data: validReply });
    expect(extra).toEqual([]);
  });

  it("detaches the listeners and terminates the worker on dispose", () => {
    const { client, events, worker } = setup();
    client.dispose();
    worker.fire("message", { data: validReply });
    worker.fire("error");
    expect(events).toEqual([]);
    expect(worker.terminated).toBe(true);
  });
});
