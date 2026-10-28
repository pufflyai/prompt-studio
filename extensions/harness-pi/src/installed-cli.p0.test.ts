import { afterEach, describe, expect, test } from "bun:test";
import { piFixture } from "./cli.test-helpers";

describe.if(process.env.INSTALLED_CLI_TESTS === "1")("installed Pi CLI", () => {
  let fixture: Awaited<ReturnType<typeof piFixture>>;
  afterEach(async () => {
    await fixture?.close();
  });

  test("detects the installed CLI and discovers a configured model", async () => {
    fixture = await piFixture(true);
    expect(await fixture.harness.detect!(fixture.context)).toMatchObject({ available: true });
    expect(await fixture.harness.listModels!(fixture.context)).toContainEqual(
      expect.objectContaining({ id: "fixture/test" }),
    );
  });

  test("runs a tool and resumes its native session without an account", async () => {
    fixture = await piFixture(true);
    const events = fixture.sink();
    const input = { prompt: "Use the tool", sessionId: "installed", cwd: fixture.root, model: "fixture/test", events };
    const first = await fixture.harness.start(fixture.context, input);
    expect(await first.done).toEqual({ status: "completed" });
    const next = await fixture.harness.resume(fixture.context, {
      ...input,
      prompt: "Follow up",
      agentSessionId: first.agentSessionId!,
    });
    expect(await next.done).toEqual({ status: "completed" });
    const messages = await fixture.harness.getMessages!(fixture.context, {
      agentSessionId: first.agentSessionId!,
      cwd: fixture.root,
    });
    expect(messages).toEqual(events.getMessages());
  });
});
