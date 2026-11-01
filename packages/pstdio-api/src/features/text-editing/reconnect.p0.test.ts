import { afterEach, expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createClient } from "@pstdio/sdk/client";
import { createTextEditingClient } from "@pstdio/sdk/extensions";
import type { TextEditingConnectionInput } from "pstdio-api-contracts";
import type { TextOpenInput } from "pstdio-api-contracts/extension-kernel";
import { editorView, selected, textEditingFixture } from "../../services/text-editing/text-editing.test-fixture";
import { createTextEditingRoutes } from "./routes";

const fixtures: Awaited<ReturnType<typeof textEditingFixture>>[] = [];
afterEach(async () => {
  for (const fixture of fixtures.splice(0)) await fixture.cleanup();
});
const setup = async (
  scope: TextEditingConnectionInput = { kind: "agent", target: selected },
  source?: TextOpenInput,
) => {
  const fixture = await textEditingFixture();
  const application = () => new OpenAPIHono().route("/v1", createTextEditingRoutes(fixture.text));
  let app = application();
  let server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: app.fetch });
  const port = server.port;
  fixtures.push({
    ...fixture,
    cleanup: async () => {
      await server.stop(true);
      await fixture.cleanup();
    },
  });
  let afterReply: ((request: Request) => Promise<void>) | undefined;
  const client = createClient({
    baseUrl: server.url.toString().replace(/\/$/, ""),
    fetch: (async (url, options) => {
      const request = new Request(url, options);
      const response = await fetch(request.clone());
      await afterReply?.(request);
      return response;
    }) as typeof fetch,
  });
  const connection = await client.textEditing.connect({
    projectId: "project-1",
    scope,
  });
  const guest = connection.guest();
  const text = createTextEditingClient(guest.host);
  const session = await text.open(source ?? { grant: (await text.current())! });
  return {
    ...fixture,
    session,
    guest,
    connection,
    textClient: text,
    hold: (handler?: typeof afterReply) => {
      afterReply = handler;
    },
    restart: async () => {
      await server.stop(true);
      await fixture.restartText();
      app = application();
      server = Bun.serve({ hostname: "127.0.0.1", port, fetch: app.fetch });
    },
  };
};

test("a public session reacquires its source after service restart and recovers edits behind a lost acknowledgement", async () => {
  const f = await setup();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let held = false;
  try {
    f.session.transact((text) => text.insert(0, "saved "));
    await f.session.flush();
    await f.session.project();
    f.hold(async (request) => {
      if (!request.url.endsWith("/request")) return;
      const { request: input } = await request.json();
      if (input.operation === "submit" && !held) {
        held = true;
        entered.resolve();
        await release.promise;
        throw new Error("Lost reply while the service restarted");
      }
    });
    f.session.transact((text) => text.insert(0, "once "));
    const flushing = f.session.flush();
    await Promise.race([
      entered.promise,
      flushing.then(() => {
        throw new Error("Submit did not reach the held reply");
      }),
    ]);
    f.session.transact((text) => text.insert(text.length, " later"));
    await f.restart();
    release.resolve();
    await expect(flushing).rejects.toBeDefined();
    await f.session.retry();
    expect(f.session.getSnapshot().text.toString()).toBe("once saved selected folder later");
    expect(f.session.getSnapshot().pending).toBe(false);
    await f.session.project();
    expect(await readFile(join(f.root, "notes.txt"), "utf8")).toBe("once saved selected folder later");
    await f.session.close();
  } finally {
    release.resolve();
    await f.guest.close().catch(() => {});
  }
});

test("restart recovery refuses a different source before admitting the retained edits", async () => {
  const f = await setup();
  try {
    await writeFile(join(f.root, "alternate-source"), "");
    await writeFile(join(f.root, "replacement.txt"), "Replacement source");
    await f.restart();
    f.session.transact((text) => text.insert(0, "keep old recovery "));
    await expect(f.session.flush()).rejects.toMatchObject({ code: "source_retired" });
    expect(f.session.getSnapshot().pending).toBe(true);
    expect(f.session.getSnapshot().text.toString()).toBe("keep old recovery selected folder");
    expect(await readFile(join(f.root, "replacement.txt"), "utf8")).toBe("Replacement source");
  } finally {
    await f.guest.close().catch(() => {});
  }
});

test("an owned source can commit a new draft after its parent session rejoins", async () => {
  const f = await setup({ kind: "placement", viewId: editorView }, { sourceId: "body", params: {} });
  try {
    await f.restart();
    f.session.transact((text) => text.insert(text.length, " rejoined"));
    await f.session.flush();
    const draft = f.session.createDraft();
    draft.text.insert(draft.text.length, " drafted");
    await draft.commit();
    expect(f.session.getSnapshot().text.toString()).toBe("Editor owned rejoined drafted");
    expect(f.session.getSnapshot().pending).toBe(false);
    await f.session.close();
  } finally {
    await f.guest.close().catch(() => {});
  }
});

test("close after restart still asks an unopened renewed member to finish or cancel its local draft", async () => {
  const f = await setup();
  try {
    const draft = f.session.createDraft();
    draft.text.insert(0, "tentative ");
    await f.restart();
    await expect(f.guest.close()).rejects.toMatchObject({ code: "draft_active" });
    expect(f.session.getSnapshot().closing).toBe(false);
    expect(draft.text.toString()).toBe("tentative selected folder");
    draft.cancel();
    await f.session.close();
  } finally {
    await f.guest.close().catch(() => {});
  }
});

test("a lost prepared-close acknowledgement keeps input closed until the host confirms cancellation", async () => {
  const f = await setup();
  let lose = true;
  f.hold(async (request) => {
    if (request.url.endsWith("/prepare-close") && lose) {
      lose = false;
      throw new Error("Prepared close acknowledgement lost");
    }
  });
  try {
    await expect(f.guest.close()).rejects.toBeDefined();
    expect(f.session.getSnapshot().closing).toBe(true);
    expect(() => f.session.transact((text) => text.insert(0, "after preparation "))).toThrow();
    await f.guest.close();
    expect(f.session.getSnapshot().pending).toBe(false);
    expect(f.documents.sources.current({ workbenchId: "project-1", extensionId: "example.context" })).toEqual([]);
  } finally {
    await f.guest.close().catch(() => {});
  }
});
