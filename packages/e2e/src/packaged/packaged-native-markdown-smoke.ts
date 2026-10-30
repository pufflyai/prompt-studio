import { expect } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect as expectEventually } from "@playwright/test";
import { createClient } from "@pstdio/sdk/client";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import * as Y from "yjs";

export const writeNativeMarkdownExtension = (root: string) => {
  const source = join(root, "extension-sources", "native-markdown");
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      publisher: "test",
      name: "native-markdown",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `export default {
    views: [{ id: "document", ref: { kind: "view", id: "document" }, title: "Document", body: {
      kind: "file",
      load: async ctx => ({ fileName: "native-shared.md", content: await ctx.workspaceFiles.readText("native-shared.md"), documentSource: {kind: "workspace", path: "native-shared.md"} }),
      save: async (ctx, input) => {
        if (await ctx.extensionFiles.exists("race")) {
          await ctx.extensionFiles.writeText("race-entered", "ready");
          while (!(await ctx.extensionFiles.exists("race-release"))) await Bun.sleep(10);
        }
        await ctx.workspaceFiles.writeText("native-shared.md", input.content);
        await ctx.extensionFiles.writeText("saved.txt", input.content);
      },
    }}],
  };`,
  );
  return source;
};

export const expectPackagedNativeMarkdown = async (input: {
  baseUrl: string;
  projectId: string;
  projectFolder: string;
  headers: Record<string, string>;
}) => {
  const token = (input.headers.authorization ?? input.headers.Authorization)?.replace(/^Bearer\s+/i, "");
  const client = createClient({ baseUrl: input.baseUrl, token });
  const path = join(input.projectFolder, "native-shared.md");
  const frontmatter = "---\r\ncustom: keep  \r\n---\r\n\r\n";
  writeFileSync(path, `${frontmatter}Initial source`);
  const target = { fileRendererId: "test.native-markdown.view.document", resource: undefined };
  const first = await client.nativeDocuments.open({ projectId: input.projectId, target });
  const second = await client.nativeDocuments.open({ projectId: input.projectId, target });
  try {
    expect(first.documentKey).toBe(second.documentKey);
    expect(first.state.length).toBeGreaterThan(2);
    const expected = `${frontmatter}Outside edit`;
    writeFileSync(path, expected);
    const address = { projectId: input.projectId, documentKey: first.documentKey, roomId: first.roomId };
    await expectEventually
      .poll(async () => {
        const document = new Y.Doc();
        try {
          Y.applyUpdate(document, (await client.nativeDocuments.snapshot(address)).state);
          return document.getText("content").toString();
        } finally {
          document.destroy();
        }
      })
      .toBe(expected);
    const snapshot = await client.nativeDocuments.snapshot(address);
    const peer = await client.nativeDocuments.snapshot({ ...address, roomId: second.roomId });
    expect(snapshot.state).toEqual(peer.state);
    expect(readFileSync(path, "utf8")).toBe(expected);
    await expectEventually
      .poll(() => {
        const saved = join(input.projectFolder, ".pstdio/extension-storage/test.native-markdown/saved.txt");
        return existsSync(saved) ? readFileSync(saved, "utf8") : null;
      })
      .toBe(expected);
    const directory = join(input.projectFolder, ".pstdio/extension-storage/test.native-markdown");
    const author = new Y.Doc();
    try {
      Y.applyUpdate(author, snapshot.state);
      const vector = Y.encodeStateVector(author);
      author.getText("content").insert(frontmatter.length, "LOCAL ");
      writeFileSync(join(directory, "race"), "pause");
      const saving = client.nativeDocuments.submit({ ...address, update: Y.encodeStateAsUpdate(author, vector) });
      while (!existsSync(join(directory, "race-entered"))) await Bun.sleep(10);
      const accepted = await saving;
      Y.applyUpdate(author, accepted.state);
      expect(author.getText("content").toString()).toBe(`${frontmatter}LOCAL Outside edit`);
      const peer = new Y.Doc();
      try {
        Y.applyUpdate(peer, (await client.nativeDocuments.snapshot({ ...address, roomId: second.roomId })).state);
        expect(peer.getText("content").toString()).toBe(`${frontmatter}LOCAL Outside edit`);
      } finally {
        peer.destroy();
      }
      expect(readFileSync(path, "utf8")).toBe(expected);
      writeFileSync(path, `${expected} OUTSIDE`);
      writeFileSync(join(directory, "race-release"), "continue");
      expect(readFileSync(path, "utf8")).toBe(`${expected} OUTSIDE`);
      rmSync(join(directory, "race"));
      await expectEventually
        .poll(async () => {
          await client.nativeDocuments.snapshot(address);
          return readFileSync(path, "utf8");
        })
        .toBe(`${frontmatter}LOCAL Outside edit OUTSIDE`);
    } finally {
      author.destroy();
      writeFileSync(join(directory, "race-release"), "continue");
    }
  } finally {
    await client.nativeDocuments.close({
      projectId: input.projectId,
      documentKey: first.documentKey,
      roomId: first.roomId,
    });
    await client.nativeDocuments.close({
      projectId: input.projectId,
      documentKey: second.documentKey,
      roomId: second.roomId,
    });
  }
};
