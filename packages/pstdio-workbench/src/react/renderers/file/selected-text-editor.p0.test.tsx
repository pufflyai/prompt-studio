import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkbench, type WorkbenchPanelRenderInput } from "../../../core";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { SelectedTextEditor } from "./selected-text-editor";

test.each([
  "react",
  "webview",
] as const)("opens the selected %s text editor with its host-owned document target", (kind) => {
  const workbench = createWorkbench();
  let received: WorkbenchPanelRenderInput | undefined;
  workbench.views.registerView({
    id: "acme.editor.view.editor",
    title: "Editor",
    body: {
      kind,
      render: (input) => {
        received = input;
        return "Editor ready";
      },
    },
  });
  const resource = { type: "note", id: "note-1" };
  const markup = renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <SelectedTextEditor
        open
        presentationInput={{
          workbench,
          panel: { id: "note", title: "Note", region: "main", rendererId: "notes.file" },
          instance: { instanceId: "note-1", panelId: "note", resource, closable: true },
          refresh: () => {},
          visible: false,
        }}
        contribution={{
          id: "notes.file",
          title: "Notes",
          source: "extension",
          ownerId: "acme.notes",
          priority: 0,
          load: () => ({}),
        }}
        content={{
          textEditor: { kind: "view", extensionId: "acme.editor", id: "editor" },
          textDocument: { sourceId: "note-text", params: {} },
        }}
        pageParams={{ noteId: "note-1" }}
      />
    </WorkbenchThemeProvider>,
  );
  expect(markup.includes("Editor ready")).toBe(true);
  expect(received?.visible).toBe(false);
  expect(received?.textTarget).toEqual({ fileRendererId: "notes.file", resource, pageParams: { noteId: "note-1" } });
});
