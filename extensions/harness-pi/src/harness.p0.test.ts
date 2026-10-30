import { afterEach, expect, test } from "bun:test";
import { ProjectTrustStore, SessionManager } from "@earendil-works/pi-coding-agent";
import { piFixture } from "./cli.test-helpers";
import { createPiHarness } from "./harness";

let fixture: Awaited<ReturnType<typeof piFixture>>;
afterEach(async () => {
  await fixture?.close();
});

test.each(["start", "resume", "getMessages"] as const)("refuses vulnerable Pi during %s", async (action) => {
  fixture = await piFixture();
  const entry = `${fixture.root}/unsupported.ts`;
  const marker = `${fixture.root}/ran`;
  await Bun.write(
    entry,
    `if (process.argv.includes('--version')) console.log('0.78.1');
     else {
       await Bun.write(${JSON.stringify(marker)}, 'ran');
       console.log(JSON.stringify({type:'session',id:'unsupported'}));
       console.log(JSON.stringify({type:'response',id:'request',success:true,data:{sessionFile:'missing'}}));
     }`,
  );
  const harness = createPiHarness({ command: [process.execPath, entry] });
  const input = {
    prompt: "Hello",
    sessionId: "unsupported",
    agentSessionId: "existing",
    cwd: fixture.root,
    events: fixture.sink(),
  };
  await expect(harness[action](fixture.context, input)).rejects.toThrow("Requires Pi 0.79.0");
  expect(await Bun.file(marker).exists()).toBe(false);
});

test("discovers authenticated Pi models", async () => {
  fixture = await piFixture();
  const account = await fixture.harness.getAuthentication!(fixture.context, { model: "fixture/test" });
  expect(account.status).toBe("signed_in");
  expect(account.providers.find((provider) => provider.id === "fixture")?.canLogout).toBe(false);
  expect(await fixture.harness.detect!(fixture.context)).toMatchObject({ available: true, version: "0.79.0" });
  expect(await fixture.harness.listModels!(fixture.context)).toContainEqual({
    id: "fixture/test",
    label: "Local fixture",
    paramOverrides: { thinking: null },
  });
});

test("streams a real tool run, reads history and resumes the same native session", async () => {
  fixture = await piFixture();
  const events = fixture.sink();
  const input = {
    prompt: "Use the tool",
    sessionId: "host-session",
    cwd: fixture.root,
    model: "fixture/test",
    params: { thinking: "off" },
    events,
  };
  const session = await fixture.harness.start(fixture.context, input);
  expect(session.agentSessionId).toBeTruthy();
  expect(await session.done).toEqual({ status: "completed" });
  expect(events.patches.length).toBeGreaterThan(3);
  expect(events.getMessages().flatMap((message) => message.parts)).toContainEqual(
    expect.objectContaining({
      type: "tool",
      tool: "read",
      status: "completed",
      state: expect.objectContaining({ output: "Hello file" }),
    }),
  );
  const history = await fixture.harness.getMessages!(fixture.context, {
    agentSessionId: session.agentSessionId!,
    cwd: fixture.root,
  });
  expect(history).toEqual(events.getMessages());
  const resumed = await fixture.harness.resume(fixture.context, {
    ...input,
    prompt: "Follow up",
    agentSessionId: session.agentSessionId!,
    messageOffset: history.length,
  });
  expect(resumed.agentSessionId).toBe(session.agentSessionId);
  expect(await resumed.done).toEqual({ status: "completed" });
  expect(events.getMessages().filter((message) => message.role === "user")).toHaveLength(2);
  const recovered = await fixture.harness.getMessages!(fixture.context, {
    agentSessionId: session.agentSessionId!,
    cwd: fixture.root,
  });
  expect(recovered).toEqual(events.getMessages());
  expect(JSON.stringify(fixture.requests.at(-1))).toContain("Hello file");
});

test("marks a real provider error as failed", async () => {
  fixture = await piFixture();
  const events = fixture.sink();
  const session = await fixture.harness.start(fixture.context, {
    prompt: "failure",
    sessionId: "failure",
    cwd: fixture.root,
    model: "fixture/test",
    events,
  });
  expect(await session.done).toEqual({ status: "failed" });
  expect(events.getMessages().flatMap((message) => message.parts)).toContainEqual(
    expect.objectContaining({ type: "error", message: expect.stringContaining("Fixture provider failure") }),
  );
});

test("stops active work and scopes extension disposal to its project", async () => {
  fixture = await piFixture();
  const session = await fixture.harness.start(fixture.context, {
    prompt: "wait",
    sessionId: "waiting",
    cwd: fixture.root,
    model: "fixture/test",
    events: fixture.sink(),
  });
  await fixture.harness.dispose!({ ...fixture.context, projectId: "other" });
  await session.stop();
  expect(await session.done).toEqual({ status: "cancelled" });
  expect(() => process.kill(session.pid!, 0)).toThrow();
  const next = await fixture.harness.start(fixture.context, {
    prompt: "wait",
    sessionId: "waiting-again",
    cwd: fixture.root,
    model: "fixture/test",
    events: fixture.sink(),
  });
  await fixture.harness.dispose!(fixture.context);
  expect(await next.done).toEqual({ status: "cancelled" });
});

test("honors request cancellation before and after startup", async () => {
  fixture = await piFixture();
  const controller = new AbortController();
  const input = {
    prompt: "wait",
    sessionId: "cancel",
    cwd: fixture.root,
    model: "fixture/test",
    events: fixture.sink(),
    signal: controller.signal,
  };
  const session = await fixture.harness.start(fixture.context, input);
  controller.abort();
  expect(await session.done).toEqual({ status: "cancelled" });
  expect(() => fixture.harness.start(fixture.context, input)).toThrow();
});

test("passes attachments to Pi and keeps host file metadata during recovery", async () => {
  fixture = await piFixture();
  const events = fixture.sink();
  const attachment = {
    fileId: "file-1",
    fileName: "hello.txt",
    mimeType: "text/plain",
    sizeBytes: 10,
    localPath: `${fixture.root}/hello.txt`,
    url: "/files/file-1",
  };
  const session = await fixture.harness.start(fixture.context, {
    prompt: "Read this",
    sessionId: "attachment",
    cwd: fixture.root,
    model: "fixture/test",
    events,
    attachments: [attachment],
  });
  expect(await session.done).toEqual({ status: "completed" });
  expect(JSON.stringify(fixture.requests[0])).toContain("Hello file");
  const nativeMessages = await fixture.harness.getMessages!(fixture.context, {
    agentSessionId: session.agentSessionId!,
    cwd: fixture.root,
  });
  const recovered = await fixture.harness.recoverMessages!(fixture.context, {
    knownMessages: events.getMessages(),
    nativeMessages,
  });
  expect(recovered).toMatchObject({
    kind: "recovered",
    messages: [
      {
        role: "user",
        parts: [
          { type: "text", text: "Read this" },
          { type: "file", fileId: "file-1" },
        ],
      },
      { role: "assistant" },
    ],
  });
});

test("keeps complete history and unique identities after Pi compacts its model context", async () => {
  fixture = await piFixture();
  const events = fixture.sink();
  const input = { prompt: "First", sessionId: "compact", cwd: fixture.root, model: "fixture/test", events };
  const session = await fixture.harness.start(fixture.context, input);
  await session.done;
  const second = await fixture.harness.resume(fixture.context, {
    ...input,
    prompt: "Second",
    agentSessionId: session.agentSessionId!,
  });
  await second.done;
  const paths = await Array.fromAsync(
    new Bun.Glob("agent/sessions/**/*.jsonl").scan({ cwd: fixture.root, absolute: true }),
  );
  const manager = SessionManager.open(paths[0]);
  const secondUser = manager
    .getEntries()
    .filter((entry) => entry.type === "message" && entry.message.role === "user")[1];
  manager.appendCompaction("Summary of first turn", secondUser.id, 1000);
  const nativeMessages = await fixture.harness.getMessages!(fixture.context, {
    agentSessionId: session.agentSessionId!,
    cwd: fixture.root,
  });
  expect(nativeMessages).toEqual(events.getMessages());
  const recovered = await fixture.harness.recoverMessages!(fixture.context, {
    knownMessages: events.getMessages(),
    nativeMessages,
  });
  expect(recovered).toEqual({ kind: "recovered", messages: events.getMessages() });
});

test.each([false, true])("applies saved project trust %s to native extensions and their history", async (trusted) => {
  fixture = await piFixture();
  await Bun.write(
    `${fixture.root}/.pi/extensions/context.ts`,
    `export default function(pi) { pi.on("before_agent_start", () => ({ message: { customType: "fixture", content: "Visible context", display: true } })); }`,
  );
  new ProjectTrustStore(`${fixture.root}/agent`).set(fixture.root, trusted);
  const events = fixture.sink();
  const session = await fixture.harness.start(fixture.context, {
    prompt: "First",
    sessionId: "custom",
    cwd: fixture.root,
    model: "fixture/test",
    events,
  });
  expect(await session.done).toEqual({ status: "completed" });
  const parts = events.getMessages().flatMap((message) => message.parts);
  const context = { type: "text", text: "Visible context" } as const;
  if (trusted) expect(parts).toContainEqual(context);
  else expect(parts).not.toContainEqual(context);
  const nativeMessages = await fixture.harness.getMessages!(fixture.context, {
    agentSessionId: session.agentSessionId!,
    cwd: fixture.root,
  });
  // Pi timestamps custom messages again when persisting them.
  const identityAndContent = (messages: typeof nativeMessages) => messages.map(({ createdAt, ...message }) => message);
  expect(identityAndContent(nativeMessages)).toEqual(identityAndContent(events.getMessages()));
  const recovered = await fixture.harness.recoverMessages!(fixture.context, {
    knownMessages: events.getMessages(),
    nativeMessages,
  });
  expect(recovered.kind).toBe("recovered");
  if (recovered.kind === "recovered")
    expect(new Set(recovered.messages.map((message) => message.id)).size).toBe(recovered.messages.length);
});
