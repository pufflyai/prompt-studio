import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessAttachment, HarnessContext, SessionMessage } from "@pstdio/sdk/extensions";
import { createOpencodeHarness } from "./harness";
import { recordingSink } from "./opencode-session-poller.test-helpers";

const notesPath = join(tmpdir(), "pstdio-oc-notes.txt");
writeFileSync(notesPath, "hello notes");
const notesDataUrl = `data:text/plain;base64,${Buffer.from("hello notes").toString("base64")}`;

const ctx: HarnessContext = {
  extensionId: "pstdio.harness-open-code",
  name: "harness-open-code",
  connections: {
    request: async () => {
      throw new Error("No connections are configured in this test");
    },
    stream: async function* () {
      yield { type: "end" } as const;
    },
  },
  process: {
    run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    runOrThrow: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    spawnDetached: async () => ({}),
  },
  net: { findFreePort: async () => 0 },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  state: { get: async () => undefined, set: async () => {}, delete: async () => {} },
};

const attachment: HarnessAttachment = {
  fileId: "file-notes",
  fileName: "notes.txt",
  mimeType: "text/plain",
  sizeBytes: 11,
  localPath: notesPath,
  url: "/v1/projects/project/session-attachments/file-notes/content",
};

const serviceOverrides = (messages: Record<string, unknown[]>) => ({
  startServer: async () => "http://localhost:4096",
  serverStore: { read: async () => null, write: async () => {}, clear: async () => {} },
  pingServer: async () => true,
  isPortOpen: async () => true,
  fetcher: async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (method === "POST" && url.includes("/session?")) {
      messages["oc-1"] = [];
      return new Response(JSON.stringify({ id: "oc-1" }));
    }

    const postMatch = method === "POST" && url.match(/\/session\/([^/]+)\/message/);
    if (postMatch) {
      const id = postMatch[1]!;
      const body = JSON.parse(String(init?.body)) as { parts: unknown[] };
      messages[id] = [
        ...(messages[id] ?? []),
        { role: "user", content: body.parts },
        { role: "assistant", content: [{ type: "text", text: "done" }] },
      ];
      return new Response(JSON.stringify({ info: {}, parts: [] }));
    }

    const getMatch = method === "GET" && url.match(/\/session\/([^/]+)\/message/);
    if (getMatch) return new Response(JSON.stringify(messages[getMatch[1]!] ?? []));

    return new Response("{}", { status: 404 });
  },
});

const harness = (messages: Record<string, unknown[]>) =>
  createOpencodeHarness(
    {
      detect: async () => ({ available: true }),
      getModelsOutput: async () => "",
    },
    serviceOverrides(messages),
  );

const latestMessages = (patches: ReturnType<typeof recordingSink>["patches"]) => {
  const messagePatch = patches.filter((patch) => patch.path === "/messages").at(-1);
  return messagePatch?.value as SessionMessage[];
};

const expectUserAttachment = (message: SessionMessage | undefined, text: string) => {
  expect(message?.parts).toContainEqual({ type: "text", text });
  expect(message?.parts).toContainEqual({
    type: "file",
    fileId: "file-notes",
    filename: "notes.txt",
    mediaType: "text/plain",
    url: notesDataUrl,
  });
  expect(message?.parts).not.toContainEqual(
    expect.objectContaining({ text: expect.stringContaining("<session-attachments>") }),
  );
};

describe("OpenCode session attachments", () => {
  test("start preserves submitted attachments when polling provider transcript messages", async () => {
    const messages: Record<string, unknown[]> = {};
    const { patches, sink } = recordingSink();
    const session = await harness(messages).start(ctx, {
      prompt: "Use the attachment",
      attachments: [attachment],
      sessionId: "host-1",
      cwd: "/repo",
      events: sink,
    });

    await session.done;

    expectUserAttachment(latestMessages(patches)[0], "Use the attachment");
  });

  test("resume preserves submitted attachments when polling provider transcript messages", async () => {
    const messages: Record<string, unknown[]> = {
      "oc-1": [
        { role: "user", content: [{ type: "text", text: "initial" }] },
        { role: "assistant", content: [{ type: "text", text: "ok" }] },
      ],
    };
    const { patches, sink } = recordingSink();
    const session = await harness(messages).resume(ctx, {
      agentSessionId: "oc-1",
      prompt: "Follow up with attachment",
      attachments: [attachment],
      sessionId: "host-1",
      cwd: "/repo",
      events: sink,
    });

    await session.done;

    expectUserAttachment(latestMessages(patches)[2], "Follow up with attachment");
  });
});
