import { expect } from "bun:test";
import type { TreeViewSection } from "@pstdio/sdk/extensions";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

export const expectNotesResources = async (input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
  metadata: WorkbenchExtensionMetadata;
}) => {
  const { baseUrl, projectId, headers, metadata } = input;
  const execute = async (id: string, params: object) => {
    const response = await fetch(`${baseUrl}/v1/projects/${projectId}/extensions/commands/${id}/execute`, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ params, source: "api" }),
    });
    expect(response.status).toBe(200);
    const result = (await response.json()) as { outcome: { status: string; value: unknown } };
    expect(result.outcome.status).toBe("success");
    return result.outcome.value;
  };
  const provider = metadata.commandPaletteResources.find((entry) => entry.extensionId === "pstdio.pstdio-notes");
  expect(provider).toBeDefined();
  const tree = metadata.views.find((entry) => entry.id === "pstdio.pstdio-notes.view.note-list")!;
  if (tree.body.kind !== "tree") throw new Error("Missing Notes tree");
  expect(tree.body.moveHandlerId).toBeDefined();
  const note = (await execute("pstdio.pstdio-notes.command.notes.create", { title: "Packaged note search" })) as {
    id: string;
    title: string;
  };
  const folder = (await execute("pstdio.pstdio-notes.command.folders.create", { title: "Packaged folder" })) as {
    id: string;
  };
  const results = await execute(provider!.queryHandlerId, { query: "packaged note", limit: 5 });
  expect(results).toMatchObject({
    items: [
      {
        id: note.id,
        target: {
          kind: "compound",
          targets: [{ kind: "page" }, { kind: "panel", resource: { id: note.id, type: "note" } }],
        },
      },
    ],
  });
  const renderer = { rendererId: tree.id, projectId };
  await execute(tree.body.moveHandlerId!, { renderer, source: { id: note.id }, target: { id: `folder:${folder.id}` } });
  const sections = (await execute(tree.body.bodyHandlerId, { renderer })) as TreeViewSection[];
  expect(sections[0]!.nodes[0]!.children!.find((child) => child.id === `folder:${folder.id}`)?.children).toMatchObject([
    { id: note.id, resource: { type: "note", id: note.id, extensionId: "pstdio.pstdio-notes", projectId } },
  ]);
};
