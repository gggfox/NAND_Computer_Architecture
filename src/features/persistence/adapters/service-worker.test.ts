import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { SKIP_WAITING, watchForUpdates } from "./service-worker";
import type { UpdateHooks, WorkerContainer, WorkerRegistration } from "./service-worker";

type Listener = () => void;

/** A minimal EventTarget: records listeners per type and fires them on demand. */
const emitter = (): {
  readonly addEventListener: (type: string, listener: Listener) => void;
  readonly fire: (type: string) => void;
} => {
  const listeners = new Map<string, Listener[]>();
  return {
    addEventListener: (type, listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    fire: (type) => {
      for (const listener of listeners.get(type) ?? []) {
        listener();
      }
    },
  };
};

const fakeWorker = (state: string) => {
  const events = emitter();
  const worker = {
    state,
    postMessage: vi.fn<(message: unknown) => void>(),
    addEventListener: events.addEventListener,
  };
  return { worker, fire: events.fire };
};

interface Harness {
  readonly container: WorkerContainer & { controller: unknown };
  readonly registration: WorkerRegistration & {
    waiting: WorkerRegistration["waiting"];
    installing: WorkerRegistration["installing"];
  };
  readonly fireContainer: (type: string) => void;
  readonly fireRegistration: (type: string) => void;
  readonly hooks: {
    readonly onUpdateReady: Mock<UpdateHooks["onUpdateReady"]>;
    readonly beforeReload: Mock<UpdateHooks["beforeReload"]>;
    readonly reload: Mock<UpdateHooks["reload"]>;
  };
}

const harness = (controlled: boolean): Harness => {
  const containerEvents = emitter();
  const registrationEvents = emitter();
  return {
    container: {
      controller: controlled ? {} : undefined,
      addEventListener: containerEvents.addEventListener,
    },
    registration: {
      waiting: undefined,
      installing: undefined,
      addEventListener: registrationEvents.addEventListener,
    },
    fireContainer: containerEvents.fire,
    fireRegistration: registrationEvents.fire,
    hooks: {
      onUpdateReady: vi.fn<UpdateHooks["onUpdateReady"]>(),
      beforeReload: vi.fn<UpdateHooks["beforeReload"]>(() => Promise.resolve()),
      reload: vi.fn<UpdateHooks["reload"]>(),
    },
  };
};

describe("watchForUpdates", () => {
  it("offers an update already waiting, and applying it asks the worker to skip waiting", () => {
    const env = harness(true);
    const waiting = fakeWorker("installed");
    env.registration.waiting = waiting.worker;
    watchForUpdates(env.container, env.registration, env.hooks);
    expect(env.hooks.onUpdateReady).toHaveBeenCalledTimes(1);
    env.hooks.onUpdateReady.mock.calls[0]?.[0]();
    expect(waiting.worker.postMessage).toHaveBeenCalledWith(SKIP_WAITING);
  });

  it("offers an update once a newly found worker finishes installing", () => {
    const env = harness(true);
    watchForUpdates(env.container, env.registration, env.hooks);
    const installing = fakeWorker("installing");
    env.registration.installing = installing.worker;
    env.fireRegistration("updatefound");
    expect(env.hooks.onUpdateReady).not.toHaveBeenCalled();
    installing.worker.state = "installed";
    env.registration.waiting = installing.worker;
    installing.fire("statechange");
    expect(env.hooks.onUpdateReady).toHaveBeenCalledTimes(1);
  });

  it("never offers the first install as an update", () => {
    const env = harness(false);
    watchForUpdates(env.container, env.registration, env.hooks);
    const installing = fakeWorker("installed");
    env.registration.installing = installing.worker;
    env.fireRegistration("updatefound");
    installing.fire("statechange");
    expect(env.hooks.onUpdateReady).not.toHaveBeenCalled();
  });
});

describe("watchForUpdates takeover", () => {
  it("flushes pending writes, then reloads once, when a new worker takes over", async () => {
    const env = harness(true);
    watchForUpdates(env.container, env.registration, env.hooks);
    env.fireContainer("controllerchange");
    env.fireContainer("controllerchange");
    await vi.waitFor(() => {
      expect(env.hooks.reload).toHaveBeenCalled();
    });
    expect(env.hooks.beforeReload).toHaveBeenCalledTimes(1);
    expect(env.hooks.reload).toHaveBeenCalledTimes(1);
    expect(env.hooks.beforeReload.mock.invocationCallOrder[0]).toBeLessThan(
      env.hooks.reload.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("does not reload when the first worker claims an uncontrolled page", () => {
    const env = harness(false);
    watchForUpdates(env.container, env.registration, env.hooks);
    env.fireContainer("controllerchange");
    expect(env.hooks.beforeReload).not.toHaveBeenCalled();
    expect(env.hooks.reload).not.toHaveBeenCalled();
  });
});
