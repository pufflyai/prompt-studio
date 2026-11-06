import { expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writeWorkspacePresentationExtension = (root: string) => {
  const source = join(root, "extension-sources", "workspace-presentation");
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "workspace-presentation",
      publisher: "test",
      version: "1.0.0",
      main: "./extension.ts",
      type: "module",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `export default { commands: [{
    id: "exercise", ref: { kind: "command", id: "exercise" }, title: "Exercise workspace services",
    async run(ctx) {
      const api = ctx.workspaces;
      const home = await api.getDefault();
      if (!home) throw new Error("Default workspace is missing");
      const id = home.id;
      await api.createDirectory(id, "workspace-probe");
      await api.createFile(id, "workspace-probe/notes.txt", { content: "Original" });
      await api.writeFile(id, "workspace-probe/notes.txt", { content: "Saved" });
      await api.moveEntry(id, "workspace-probe/notes.txt", "workspace-probe/moved.txt");
      const file = await api.readFile(id, "workspace-probe/moved.txt");
      const matches = await api.listFiles(id, { query: "moved.txt" });
      let defaultRenameRejected = false;
      try { await api.rename(id, { name: "Changed" }); } catch { defaultRenameRejected = true; }
      let unsupportedDiffsRejected = 0;
      for (const action of [() => api.diffFiles(id, "current"), () => api.diffFile(id, "current", "notes.txt"), () => api.diffSummary(id, "current")]) {
        try { await action(); } catch { unsupportedDiffsRejected++; }
      }
      await api.deleteEntry(id, "workspace-probe");
      return { content: file.content, editable: file.editable, matches: matches.entries.map(entry => entry.path), defaultRenameRejected, unsupportedDiffsRejected };
    }
  }] };`,
  );
  return source;
};

export const expectPackagedWorkspacePresentation = async (input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
}) => {
  const response = await fetch(
    `${input.baseUrl}/v1/projects/${input.projectId}/extensions/commands/test.workspace-presentation.command.exercise/execute`,
    {
      method: "POST",
      headers: { ...input.headers, "content-type": "application/json" },
      body: JSON.stringify({ source: "dashboard", params: {} }),
    },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({
    outcome: {
      status: "success",
      value: {
        content: "Saved",
        editable: true,
        matches: ["workspace-probe/moved.txt"],
        defaultRenameRejected: true,
        unsupportedDiffsRejected: 3,
      },
    },
  });
};
