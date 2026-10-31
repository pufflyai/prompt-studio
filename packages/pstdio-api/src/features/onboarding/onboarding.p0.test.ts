import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOnboarding } from "./onboarding";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
const setup = async () => {
  const root = await mkdtemp(join(tmpdir(), "onboarding-"));
  roots.push(root);
  const queued: string[] = [];
  const options = {
    path: join(root, "onboarding.json"),
    enqueue: (name: string) => {
      queued.push(name);
    },
  };
  return { options, queued, onboarding: createOnboarding(options) };
};

describe("first-launch setup", () => {
  test("queues independent choices together before waiting for durable acceptance", async () => {
    const { options, queued } = await setup();
    const entered = Promise.withResolvers<void>();
    const accepted = Promise.withResolvers<void>();
    const onboarding = createOnboarding({
      ...options,
      enqueue: async (name) => {
        queued.push(name);
        entered.resolve();
        await accepted.promise;
      },
    });
    const updating = onboarding.update({ step: "harnesses", harnesses: ["codex", "pi"] });
    try {
      await entered.promise;
      expect(queued).toEqual(["harness-codex", "harness-pi"]);
      expect((await onboarding.read()).harnesses).toBeNull();
    } finally {
      accepted.resolve();
      await updating;
    }
    expect((await onboarding.read()).harnesses).toEqual(["codex", "pi"]);
  });

  test("skips setup without starting unsubmitted installations", async () => {
    const { onboarding, queued, options } = await setup();
    await onboarding.update({ step: "harnesses", harnesses: ["codex"] });
    await onboarding.update({ step: "skip" });
    expect(queued).toEqual(["harness-codex"]);
    expect((await createOnboarding(options).read()).completed).toBe(true);
  });

  test("persists the customization without completing setup or starting installations", async () => {
    const { onboarding, queued, options } = await setup();
    await onboarding.update({ step: "visibility", hidden: true });
    expect(await createOnboarding(options).read()).toMatchObject({ hidden: true, completed: false });
    await onboarding.update({ step: "visibility", hidden: false });
    expect((await createOnboarding(options).read()).hidden).toBe(false);
    expect(queued).toEqual([]);
  });
  test("saves harness selections and starts their installation before setup completes", async () => {
    const { onboarding, queued, options } = await setup();
    await onboarding.update({ step: "harnesses", harnesses: ["codex", "pi"] });
    expect(queued).toEqual(["harness-codex", "harness-pi"]);
    expect(await createOnboarding(options).read()).toEqual({
      completed: false,
      hidden: false,
      harnesses: ["codex", "pi"],
      workAreas: null,
    });
  });

  test("allows no harness and completes independently of extension installation", async () => {
    const { onboarding, queued, options } = await setup();
    await onboarding.update({ step: "harnesses", harnesses: [] });
    await onboarding.update({ step: "complete", workAreas: ["coding", "planning"] });
    expect(await createOnboarding(options).read()).toEqual({
      completed: true,
      hidden: false,
      harnesses: [],
      workAreas: ["coding", "planning"],
    });
    expect(queued).toEqual(
      expect.arrayContaining([
        "pstdio-base-themes",
        "pstdio-skills",
        "pstdio-planner",
        "pstdio-reports",
        "pstdio-artifacts",
        "pstdio-notes",
      ]),
    );
    expect(queued).toHaveLength(6);
    expect(new Set(queued).size).toBe(queued.length);
  });

  test("keeps the shared extensions when no work area is chosen", async () => {
    const { onboarding, queued } = await setup();
    await onboarding.update({ step: "complete", workAreas: [] });
    expect(queued).toEqual(["pstdio-base-themes", "pstdio-skills"]);
  });
});
