import { expect, test } from "bun:test";
import {
  createMemoryRepoFiles,
  createMemoryResources,
  createMemoryStorage,
  makeCommandArgs,
} from "@pstdio/sdk/testing";
import { commands } from "./commands";
import type { ReviewChange } from "./review-state";

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
  expect(study).toMatchObject({ ok: true, module: { code: expect.any(String) } });
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
  expect(removed).toEqual([{ type: "motion-lab.animation", id: "tabs" }]);
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
