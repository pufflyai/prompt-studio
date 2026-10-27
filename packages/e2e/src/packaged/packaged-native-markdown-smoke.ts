import { expect } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

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
      save: async (ctx, input) => { await ctx.workspaceFiles.writeText("native-shared.md", input.content); await ctx.extensionFiles.writeText("saved.txt", input.content); },
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
  const target = { fileRendererId: "test.native-markdown.view.document" };
  const first = await client.nativeDocuments.open({ projectId: input.projectId, target });
  const second = await client.nativeDocuments.open({ projectId: input.projectId, target });
  try {
    expect(first.documentKey).toBe(second.documentKey);
    expect(first.state.length).toBeGreaterThan(2);
    const expected = `${frontmatter}Outside edit`;
    writeFileSync(path, expected);
    const address = { projectId: input.projectId, documentKey: first.documentKey, roomId: first.roomId };
    const snapshot = await client.nativeDocuments.snapshot(address);
    const peer = await client.nativeDocuments.snapshot({ ...address, roomId: second.roomId });
    expect(snapshot.state).toEqual(peer.state);
    expect(readFileSync(path, "utf8")).toBe(expected);
    expect(
      readFileSync(join(input.projectFolder, ".pstdio/extension-storage/test.native-markdown/saved.txt"), "utf8"),
    ).toBe(expected);
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
