import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { notesFileAccess } from "./file-access";
import { documentPaths } from "./mounts";
import { noteExists, readNoteTitle } from "./notes";
import { noteResource, notesMount, noteTarget } from "./pages";

export const resolveNotePathCommand = defineCommand({
  id: "notes.resolve-path",
  title: l10n("commands.resolveNotePath", "Resolve note path"),
  params: { path: params.text({ required: true }), workspaceId: params.text({ required: true }) },
  async run(ctx, input) {
    const prefix = documentPaths.find((prefix) => input.path.startsWith(prefix));
    if (!prefix) return null;
    const [id, file, ...rest] = input.path.slice(prefix.length).split("/");
    if (file !== "content.md" || rest.length) return null;
    const { readable, writable } = await notesFileAccess(ctx);
    if (!readable || !(await noteExists(notesMount(ctx), id))) return null;
    const title = await readNoteTitle(notesMount(ctx), id);
    return { resource: noteResource(id, title, ctx, writable), target: noteTarget(id, title, ctx) };
  },
});
