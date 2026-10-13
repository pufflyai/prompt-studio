import { expect, test } from "bun:test";
import { defaultAutoBuildIgnore } from "../data/auto-build-mode";
import { fixture } from "./auto-build.fixture";
import { configureAutoBuildCommand, readAutoBuildCommand } from "./auto-build-mode";

test("a new project starts with empty explicit status choices and filters", async () => {
  const { ctx, storage } = await fixture();
  await storage.delete("auto-build");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    enabled: false,
    prompt: "",
    ignore: await defaultAutoBuildIgnore(ctx),
  });
});

test("saves the prompt and ignore filter across stopping and restarting", async () => {
  const { ctx, ticket } = await fixture();
  await ticket("Configure statuses");
  const ignore = {
    conjunction: "and" as const,
    rules: [{ attributeId: "title", condition: "contains" as const, value: "Postpone" }],
  };
  const first = await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    prompt: "Focus on the release.",
    ignore,
    eligibleStatusIds: ["ready"],
  });
  await configureAutoBuildCommand.run(ctx, { enabled: false });
  const restarted = await configureAutoBuildCommand.run(ctx, { enabled: true });
  expect(restarted.revision).not.toBe(first.revision);
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    enabled: true,
    prompt: "Focus on the release.",
    ignore,
  });
});

test("starting requires a nonempty supervisor prompt", async () => {
  const { ctx, storage } = await fixture();
  await storage.delete("auto-build");
  await expect(configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "  " })).rejects.toThrow("Enter a prompt");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
});

test("new dispatch requires explicit current eligible status IDs", async () => {
  const { ctx, storage, ticket } = await fixture();
  await ticket("Configure me");
  await storage.delete("auto-build");
  await expect(configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "Build it" })).rejects.toThrow("eligible");
  await expect(
    configureAutoBuildCommand.run(ctx, { enabled: true, prompt: "Build it", eligibleStatusIds: ["missing"] }),
  ).rejects.toThrow("missing");
  const started = await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    prompt: "Build it",
    eligibleStatusIds: ["ready"],
  });
  expect(started.eligibleStatusIds).toEqual(["ready"]);
});
