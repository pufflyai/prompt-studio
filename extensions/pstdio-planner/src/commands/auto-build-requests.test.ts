import { expect, test } from "bun:test";
import { fixture } from "./auto-build.fixture";
import { pauseAutoBuildCommand } from "./auto-build-lifecycle";
import { configureAutoBuildCommand, readAutoBuildCommand } from "./auto-build-mode";
import { requestHumanCommand, reviewCommand } from "./review-requests";

test("Auto Build exposes pending requests in its work scope above its session activity", async () => {
  const { ctx, ticket } = await fixture();
  const included = await ticket("Tool builder release");
  const excluded = await ticket("Unrelated expenses");
  const request = async (id: string) =>
    requestHumanCommand.run(ctx, {
      ticket: id,
      title: "Choose the release",
      instructions: "Review the options",
      request: { kind: "task" },
    });
  const pending = await request(included.id);
  await request(excluded.id);
  await configureAutoBuildCommand.run(ctx, {
    enabled: true,
    eligible: { conjunction: "and", rules: [{ attributeId: "title", condition: "contains", value: "Tool builder" }] },
  });
  expect((await readAutoBuildCommand.run(ctx, {})).reviewRequests.map((request) => request.id)).toEqual([pending.id]);
  await pauseAutoBuildCommand.run(ctx, {});
  expect((await readAutoBuildCommand.run(ctx, {})).reviewRequests.map((request) => request.id)).toEqual([pending.id]);
  await reviewCommand.run(ctx, { requestId: pending.id, response: { confirmed: true } });
  expect((await readAutoBuildCommand.run(ctx, {})).reviewRequests).toEqual([]);
});
