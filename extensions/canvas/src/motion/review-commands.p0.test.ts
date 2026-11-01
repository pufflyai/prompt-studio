import { expect, test } from "bun:test";
import type { CommandContext } from "@pstdio/sdk/extensions";
import {
  createMemoryRepoFiles,
  createMemoryResources,
  createMemoryStorage,
  makeCommandArgs,
} from "@pstdio/sdk/testing";
import { motionCommands as commands } from "./review-commands";
import { initialState, type ReviewChange } from "./review-state";
import { readStudy } from "./studies";

const fixture = async () => {
  const storage = createMemoryStorage();
  const projectFiles = createMemoryRepoFiles();
  await commands["study.create"].run(
    ...makeCommandArgs({
      storage,
      overrides: { projectFiles },
      params: { id: "tabs", title: "Tabs", group: "Workbench", duration: 7 },
    }),
  );
  return { storage, projectFiles };
};

test("imports a legacy review once and keeps subsequent Canvas review changes", async () => {
  const context = await fixture();
  const input = { study: "tabs" };
  const args = makeCommandArgs({ ...context, overrides: { projectFiles: context.projectFiles }, params: input });
  const initial = await commands["review.read"].run(...args);
  const legacy = {
    ...initial,
    frame: 90,
    rate: 0.5,
    loop: true,
    settings: { ...initial.settings, theme: "light" as const },
  };
  let exports = 0;
  args[0].commands.execute = (async () => {
    exports += 1;
    return { ok: true, status: "success", value: legacy };
  }) as CommandContext["commands"]["execute"];
  const imported = await commands["review.read"].run(...args);
  expect(imported).toMatchObject({ frame: 90, rate: 0.5, loop: true, legacy: true, restored: true });
  await commands["review.update"].run(args[0], { study: "tabs", change: { frame: 120 } });
  expect((await commands["review.read"].run(...args)).frame).toBe(120);
  expect(exports).toBe(1);
  await commands["study.delete"].run(args[0], { study: "tabs" });
  await commands["study.create"].run(args[0], { id: "tabs", title: "New tabs", group: "Workbench", duration: 7 });
  const recreated = await commands["review.read"].run(...args);
  expect(recreated.frame).toBe(0);
  expect(recreated.restored).toBe(false);
  expect(exports).toBe(1);
});
test("public playback actions update the chosen study's shared review state", async () => {
  const context = await fixture();
  const playing = await commands["review.playback"].run(
    ...makeCommandArgs({
      ...context,
      overrides: { projectFiles: context.projectFiles },
      params: { study: "tabs", operation: "toggle" as const },
    }),
  );
  expect(playing.playing).toBe(true);
  const restarted = await commands["review.playback"].run(
    ...makeCommandArgs({
      ...context,
      overrides: { projectFiles: context.projectFiles },
      params: { study: "tabs", operation: "restart" as const },
    }),
  );
  expect(restarted).toMatchObject({ playing: false, frame: 0 });
});
test("concurrent playback toggles each use the latest shared review state", async () => {
  const context = await fixture();
  const toggle = () =>
    commands["review.playback"].run(
      ...makeCommandArgs({
        ...context,
        overrides: { projectFiles: context.projectFiles },
        params: { study: "tabs", operation: "toggle" as const },
      }),
    );
  await Promise.all([toggle(), toggle()]);
  const state = await commands["review.read"].run(
    ...makeCommandArgs({ ...context, overrides: { projectFiles: context.projectFiles }, params: { study: "tabs" } }),
  );
  expect(state.playing).toBe(false);
});
test("concurrent preview and parameter updates preserve both changes", async () => {
  const context = await fixture();
  await Promise.all([
    commands["review.update"].run(
      ...makeCommandArgs({
        ...context,
        overrides: { projectFiles: context.projectFiles },
        params: { study: "tabs", change: { loopRange: [60, 120] } satisfies ReviewChange },
      }),
    ),
    commands["review.update"].run(
      ...makeCommandArgs({
        ...context,
        overrides: { projectFiles: context.projectFiles },
        params: { study: "tabs", change: { settings: { theme: "light" } } satisfies ReviewChange },
      }),
    ),
  ]);
  expect(
    await commands["review.read"].run(
      ...makeCommandArgs({ ...context, overrides: { projectFiles: context.projectFiles }, params: { study: "tabs" } }),
    ),
  ).toMatchObject({ loopRange: [60, 120], settings: { theme: "light" } });
});
test("creates a buildable study and deletes both its files and saved review", async () => {
  const context = await fixture();
  const study = await commands["study.read"].run(
    ...makeCommandArgs({ ...context, overrides: { projectFiles: context.projectFiles }, params: { study: "tabs" } }),
  );
  expect(study).toMatchObject({
    ok: true,
    sources: expect.objectContaining({ "study.canvas.tsx": expect.any(String) }),
  });
  await commands["review.update"].run(
    ...makeCommandArgs({
      ...context,
      overrides: { projectFiles: context.projectFiles },
      params: { study: "tabs", change: { frame: 300 } },
    }),
  );
  await commands["study.delete"].run(
    ...makeCommandArgs({ ...context, overrides: { projectFiles: context.projectFiles }, params: { study: "tabs" } }),
  );
  expect(await context.projectFiles.exists("design/motion/studies/tabs")).toBe(false);
  expect(await context.storage.collection("reviews").get("tabs")).toBeUndefined();
  expect(
    await commands["study.list"].run(
      ...makeCommandArgs({ ...context, overrides: { projectFiles: context.projectFiles }, params: {} }),
    ),
  ).toEqual({ studies: [] });
});
test("clamps the saved frame when a study becomes shorter", async () => {
  const context = await fixture();
  await commands["review.update"].run(
    ...makeCommandArgs({
      ...context,
      overrides: { projectFiles: context.projectFiles },
      params: { study: "tabs", change: { frame: 400 } },
    }),
  );
  const path = "design/motion/studies/tabs/study.json";
  const metadata = JSON.parse(await context.projectFiles.readText(path));
  await context.projectFiles.writeText(path, JSON.stringify({ ...metadata, duration: 2 }));
  expect(
    await commands["review.read"].run(
      ...makeCommandArgs({ ...context, overrides: { projectFiles: context.projectFiles }, params: { study: "tabs" } }),
    ),
  ).toMatchObject({ frame: 119 });
});
test("rejects duplicate studies without replacing their content", async () => {
  const context = await fixture();
  await expect(
    commands["study.create"].run(
      ...makeCommandArgs({
        ...context,
        overrides: { projectFiles: context.projectFiles },
        params: { id: "tabs", title: "Replacement", group: "Workbench" },
      }),
    ),
  ).rejects.toThrow("already exists");
  expect(await context.projectFiles.readText("design/motion/studies/tabs/study.json")).toContain('"Tabs"');
});

test("notifies the host after study deletion so cached resources are removed", async () => {
  const context = await fixture();
  const removed: unknown[] = [];
  await commands["study.delete"].run(
    ...makeCommandArgs({
      ...context,
      overrides: {
        projectFiles: context.projectFiles,
        resources: {
          ...createMemoryResources({}),
          removed: async (resource) => {
            expect(await context.projectFiles.exists("design/motion/studies/tabs")).toBe(false);
            removed.push(resource);
          },
        },
      },
      params: { study: "tabs" },
    }),
  );
  expect(removed).toEqual([{ type: "canvas", id: "design/motion/studies/tabs/study.canvas.tsx" }]);
});

test("reconciles saved choices with live metadata defaults and options", async () => {
  const context = await fixture();
  await commands["review.update"].run(
    ...makeCommandArgs({
      ...context,
      overrides: { projectFiles: context.projectFiles },
      params: {
        study: "tabs",
        change: { settings: { right: { values: { obsolete: "old", "treatment.mode": "removed" } } } },
      },
    }),
  );
  const path = "design/motion/studies/tabs/study.json";
  const metadata = JSON.parse(await context.projectFiles.readText(path));
  await context.projectFiles.writeText(
    path,
    JSON.stringify({
      ...metadata,
      params: [
        {
          id: "treatment.mode",
          name: "Treatment",
          type: "selection",
          options: [{ id: "fade", name: "Fade" }],
          default: { left: "fade", right: "fade" },
        },
      ],
    }),
  );
  const review = await commands["review.read"].run(
    ...makeCommandArgs({ ...context, overrides: { projectFiles: context.projectFiles }, params: { study: "tabs" } }),
  );
  expect(review.settings.right.values).toEqual({ "treatment.mode": "fade" });
  expect(review.settings.left.values).toEqual({ "treatment.mode": "fade" });
});

test("deleting a study before its first Canvas review prevents importing its old review on recreation", async () => {
  const context = await fixture();
  const result = await readStudy(context.projectFiles, "tabs");
  if (!result.ok) throw new Error(result.reason);
  const legacy = { ...initialState(result.study), frame: 90 };
  const args = makeCommandArgs({
    ...context,
    overrides: { projectFiles: context.projectFiles },
    params: { study: "tabs" },
  });
  let exports = 0;
  args[0].commands.execute = (async () => {
    exports += 1;
    return { ok: true, status: "success", value: legacy };
  }) as CommandContext["commands"]["execute"];
  await commands["study.delete"].run(args[0], { study: "tabs" });
  await commands["study.create"].run(args[0], { id: "tabs", title: "New tabs", group: "Workbench", duration: 7 });
  const recreated = await commands["review.read"].run(...args);
  expect(recreated.frame).toBe(0);
  expect(recreated.restored).toBe(false);
  expect(exports).toBe(0);
});
