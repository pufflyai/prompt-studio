import { defineExtension, definePage, defineView, workbenchModes } from "@pstdio/sdk/extensions";

let content = [
  "# Extension file view",
  "",
  "The extension supplies file content. Prompt Studio supplies the editor.",
].join("\n");

const notes = defineView({
  id: "notes",
  title: "notes.md",
  body: {
    kind: "file",
    load: async () => ({ fileName: "notes.md", content }),
    save: async (_ctx, input) => {
      content = input.content;
    },
  },
});

export const notesPage = definePage({
  id: "notes",
  title: "Notes",
  path: "notes",
  mode: workbenchModes.project,
  slots: [{ id: "content", role: "primary", region: "main", view: notes.ref }],
});

export default defineExtension({
  views: [notes],
  pages: [notesPage],
});
