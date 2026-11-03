import { afterEach, expect, test } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createClient } from "@pstdio/sdk/client";
import { createTextEditingClient } from "@pstdio/sdk/extensions";
import { selected, textEditingFixture } from "../../services/text-editing/text-editing.test-fixture";
import { createTextEditingRoutes } from "./routes";

const fixtures: Awaited<ReturnType<typeof textEditingFixture>>[] = [];
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) await fixture.cleanup();
});
test("the authenticated client edits through the same selected source admission and durable session", async () => {
  const fixture = await textEditingFixture();
  fixtures.push(fixture);
  const app = new OpenAPIHono();
  app.route("/v1", createTextEditingRoutes(fixture.text));
  const client = createClient({
    baseUrl: "http://localhost",
    fetch: ((url, options) => app.request(new Request(url, options))) as typeof fetch,
  });
  const connection = await client.textEditing.connect({
    projectId: "project-1",
    scope: { kind: "agent", target: selected },
  });
  const guest = connection.guest();
  const text = createTextEditingClient(guest.host);
  try {
    const grant = await text.current();
    const session = await text.open({ grant: grant! });
    session.transact((value) => value.insert(0, "Agent "));
    await session.flush();
    await session.project();
    expect(session.getSnapshot().text.toString()).toBe("Agent selected folder");
    expect(await Bun.file(`${fixture.root}/notes.txt`).text()).toBe("Agent selected folder");
    await expect(
      connection.request({ operation: "open", memberId: crypto.randomUUID(), input: { sourceId: "body", params: {} } }),
    ).rejects.toMatchObject({ code: "session_closed" });
    await session.close();
  } finally {
    await guest.close();
  }
});

test("an authenticated agent can resolve a provider without a file presentation", async () => {
  const fixture = await textEditingFixture();
  fixtures.push(fixture);
  const app = new OpenAPIHono();
  app.route("/v1", createTextEditingRoutes(fixture.text));
  const client = createClient({
    baseUrl: "http://localhost",
    fetch: ((url, options) => app.request(new Request(url, options))) as typeof fetch,
  });
  const connection = await client.textEditing.connect({
    projectId: "project-1",
    scope: {
      kind: "agent",
      target: { extensionId: "example.context", textDocument: { sourceId: "body", params: {} } },
    },
  });
  const guest = connection.guest();
  const text = createTextEditingClient(guest.host);
  try {
    const grant = await text.current();
    const session = await text.open({ grant: grant! });
    expect(session.getSnapshot().text.toString()).toBe("selected folder");
    await session.close();
  } finally {
    await guest.close();
  }
});
