import { afterEach, describe, expect, setSystemTime, test } from "bun:test";
import type { TreeNode } from "@pstdio/sdk/extensions";
import type { z } from "zod";
import { commands } from "../commands";
import { finish, setup } from "../commands/test-context";
import type { finishRun as finishRunInput } from "../schemas";
import { settingsMenu } from "./settings-menu";

type Context = ReturnType<typeof setup>["ctx"];
const channelRow = async (ctx: Context, id: string) => {
  const sections = await settingsMenu.body.body(ctx, { renderer: { rendererId: "settings-menu" } });
  return sections.flatMap((section) => section.nodes).find((node: TreeNode) => node.id === id);
};
// Each run starts on its own day, so the newest run is never a tie.
const finishRun = async (ctx: Context, day: number, input: Partial<z.infer<typeof finishRunInput>>) => {
  setSystemTime(new Date(Date.UTC(2026, 9, day, 7)));
  const run = await commands["run-daily"].run(ctx, {});
  await commands["finish-run"].run(ctx, { input: { ...finish(run.runId), ...input } });
};

describe("social radar channel login", () => {
  afterEach(() => setSystemTime());

  test("marks a channel the agent could not log into until a run reads it", async () => {
    const { ctx } = setup();
    await finishRun(ctx, 1, { skippedSites: [{ site: "x", reason: "Login wall", needsLogin: true }] });
    expect(await channelRow(ctx, "x")).toMatchObject({ icon: "KeyRound", iconColor: "fg.warning" });

    // A run that leaves the channel alone, such as while it is paused, says nothing about its login.
    await finishRun(ctx, 2, { searches: { hn: 1 }, skippedSites: [] });
    expect(await channelRow(ctx, "x")).toMatchObject({ icon: "KeyRound" });

    await finishRun(ctx, 3, { searches: { x: 1 }, skippedSites: [] });
    expect(await channelRow(ctx, "x")).toMatchObject({ icon: "RadioTower" });
  });

  test("other skips do not ask for a login", async () => {
    const { ctx } = setup();
    await finishRun(ctx, 1, { skippedSites: [{ site: "x", reason: "No browser tool", needsLogin: false }] });
    expect(await channelRow(ctx, "x")).toMatchObject({ icon: "RadioTower" });
  });
});
