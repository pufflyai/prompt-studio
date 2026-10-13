import { expect, test } from "bun:test";
import { defaultAutoBuildIgnore } from "../data/auto-build-mode";
import { fixture } from "./auto-build.fixture";
import { configureAutoBuildCommand, readAutoBuildCommand } from "./auto-build-mode";

test("a new project starts stopped with empty ticket filters", async () => {
  const { ctx, storage } = await fixture();
  await storage.delete("auto-build");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({
    enabled: false,
    prompt: "",
    eligible: { conjunction: "and", rules: [] },
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
    eligible: { conjunction: "and", rules: [{ attributeId: "status", condition: "is-any-of", value: ["ready"] }] },
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

test("starting rejects incomplete eligible filters and leaves the run stopped", async () => {
  const { ctx, storage } = await fixture();
  await storage.delete("auto-build");
  await expect(
    configureAutoBuildCommand.run(ctx, {
      enabled: true,
      prompt: "Build it",
      eligible: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "" }] },
    }),
  ).rejects.toThrow("eligible");
  expect(await readAutoBuildCommand.run(ctx, {})).toMatchObject({ enabled: false });
});
