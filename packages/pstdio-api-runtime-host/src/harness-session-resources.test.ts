import { describe, expect, test } from "bun:test";
import { createHarnessSessionResources } from "./harness-session-resources";

const minute = 60_000;
const setup = () => {
  let time = 0;
  const timers = new Set<{ at: number; run: () => void }>();
  const errors: unknown[] = [];
  const resources = createHarnessSessionResources({
    now: () => time,
    schedule: (run, delay) => {
      const timer = { at: time + delay, run };
      timers.add(timer);
      return () => timers.delete(timer);
    },
    onError: (error) => errors.push(error),
  });
  const advance = async (elapsed: number) => {
    time += elapsed;
    for (let pass = 0; pass < 15; pass++) {
      const due = [...timers].filter((timer) => timer.at <= time);
      for (const timer of due) {
        timers.delete(timer);
        timer.run();
      }
      await Promise.resolve();
    }
  };
  return { resources, advance, errors, timers };
};

describe("session resource retention", () => {
  test("closing many retained sessions with the same deadline shares one cleanup timer", async () => {
    let schedules = 0;
    const resources = createHarnessSessionResources({
      now: () => 0,
      schedule: () => {
        schedules++;
        return () => {};
      },
    });
    const owner = {};
    const interests = [];
    for (let index = 0; index < 10_000; index++) {
      const id = `session-${index}`;
      interests.push(resources.retain(id));
      const done = await resources.acquire(owner, id, async () => true);
      done();
    }
    for (const close of interests) close();
    expect(schedules).toBe(1);
    await resources.retire(owner);
  });

  test("ten thousand owners expire without releasing the sessions still retained by tabs", async () => {
    const { resources, advance, timers } = setup();
    const owner = {};
    const retained = [];
    let released = 0;
    for (let index = 0; index < 10_000; index++) {
      const id = `session-${index}`;
      if (index < 1_000) retained.push(resources.retain(id));
      const done = await resources.acquire(owner, id, async () => {
        released++;
        return true;
      });
      done();
    }
    await advance(30 * minute - 1);
    expect(released).toBe(0);
    await advance(1);
    expect(released).toBe(9_000);
    for (const close of retained) close();
    await advance(30 * minute);
    expect(released).toBe(10_000);
    expect(timers.size).toBe(0);
  });

  test("releases an unused conversation at thirty minutes", async () => {
    const { resources, advance } = setup();
    let released = 0;
    const use = await resources.acquire({}, "session", async () => {
      released++;
      return true;
    });
    use();
    await advance(30 * minute - 1);
    expect(released).toBe(0);
    await advance(1);
    expect(released).toBe(1);
  });

  test("open tabs in either client retain a conversation and closing starts its grace period", async () => {
    const { resources, advance } = setup();
    let released = 0;
    const first = resources.retain("session");
    const second = resources.retain("session");
    const use = await resources.acquire({}, "session", async () => {
      released++;
      return true;
    });
    use();
    await advance(90 * minute);
    first();
    await advance(90 * minute);
    expect(released).toBe(0);
    second();
    await advance(30 * minute - 1);
    expect(released).toBe(0);
    await advance(1);
    expect(released).toBe(1);
  });

  test("busy runs and controls keep their resources and restart the idle period when settled", async () => {
    const { resources, advance } = setup();
    const owner = {};
    let released = 0;
    const release = async () => {
      released++;
      return true;
    };
    const run = await resources.acquire(owner, "session", release);
    const control = await resources.acquire(owner, "session", release);
    await advance(90 * minute);
    run();
    await advance(90 * minute);
    expect(released).toBe(0);
    control();
    await advance(30 * minute);
    expect(released).toBe(1);
  });

  test("follow-up startup waits for an in-flight release of the same owner", async () => {
    const { resources, advance } = setup();
    const owner = {};
    const cleanup = Promise.withResolvers<boolean>();
    const use = await resources.acquire(owner, "session", () => cleanup.promise);
    use();
    await advance(30 * minute);
    let started = false;
    const next = resources
      .acquire(owner, "session", async () => true)
      .then((done) => {
        started = true;
        return done;
      });
    await advance(0);
    expect(started).toBe(false);
    cleanup.resolve(true);
    const done = await next;
    expect(started).toBe(true);
    done();
  });

  test("providers can defer cleanup while native work is still busy or uncertain", async () => {
    const { resources, advance } = setup();
    let attempts = 0;
    const use = await resources.acquire({}, "session", async () => ++attempts > 1);
    use();
    await advance(30 * minute);
    expect(attempts).toBe(1);
    await advance(30 * minute);
    expect(attempts).toBe(2);
    await advance(30 * minute);
    expect(attempts).toBe(2);
  });

  test("cleanup failures preserve ownership and do not affect another session", async () => {
    const { resources, advance, errors } = setup();
    let healthy = 0;
    const first = await resources.acquire({}, "failed", async () => {
      throw new Error("unavailable");
    });
    const second = await resources.acquire({}, "healthy", async () => {
      healthy++;
      return true;
    });
    first();
    second();
    await advance(30 * minute);
    expect(healthy).toBe(1);
    expect(errors).toHaveLength(1);
  });

  test("provider retirement cancels timers and waits for cleanup already in flight", async () => {
    const { resources, advance, timers } = setup();
    const owner = {};
    let calls = 0;
    const cleanup = Promise.withResolvers<boolean>();
    const use = await resources.acquire(owner, "session", () => {
      calls++;
      return cleanup.promise;
    });
    use();
    await advance(30 * minute);
    let retired = false;
    const retiring = resources.retire(owner).then(() => {
      retired = true;
    });
    await advance(0);
    expect(retired).toBe(false);
    cleanup.resolve(true);
    await retiring;
    await advance(90 * minute);
    expect(calls).toBe(1);
    expect(timers.size).toBe(0);
  });
});
