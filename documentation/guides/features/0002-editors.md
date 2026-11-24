# Editors

An editor lets a tool open and change files or documents your way, such as a storyboard, a CSV editor, or a document review tool.

## What editors give you

Prompt Studio has built-in editors for common files. A tool can reuse them for its own documents, or draw a custom editor for a format that needs one. Either way, the tool decides where the content is loaded from and where it is saved.

Editors open as tabs. A tool can also keep a whole collection of open files, like a code editor: files open as tabs in Main, with tools such as a file tree in Side or Secondary.

## Use editors in Prompt Studio

**Files** in the sidebar opens the project folder in the shared tree and editor. You can create, rename, move, and delete files and folders there, and save text with the editor's Save action or shortcut. This needs the Workspaces extension, which new projects turn on by default.

Tools bring their own editors. Notes, for example, opens each note in a Markdown editor. A tool's editor follows the same tab rules as any other view: you can drag its tab to another panel, and reopening the same document reuses its open tab.

## Add an editor to your tool

For a native editor, declare a view with `defineView` and a body of `kind: "file"`:

- `load` returns the content and a `fileName` or `mimeType`. Images open in an image preview. Files ending in `.md`, `.markdown`, or `.txt` open in the document editor; other named files open in the code editor, with plain-text highlighting for unknown formats. Unnamed documents use the document editor.
- `save` receives the edited content. Leave it out to make the editor read-only.
- `saveMode` is `"auto"` by default. Set `"manual"` to save only when the person chooses Save.

When several views show the same Markdown text, a text source declared with `defineTextSource` lets them share one document.

For a format the built-in editors do not cover, such as a storyboard or a review screen, use a webview view (`kind: "webview"`) and draw the editor yourself.

To build a workspace-style editor, give the page `main: { kind: "panels", empty: emptyView.ref }`. Put resource-bound editor slots in Main and tools in Side or Secondary. The empty view shows only while no editor is open.

Keep the tool's operations in commands, too, so that agents can change the same content without opening the editor.

## Learn more

- [Workbench cookbook: editable resource pages](../extensions/0002-workbench-cookbook.md#editable-resource-pages) shows a Markdown editor from Extension Lab.
- [Workbench cookbook: editor collections](../extensions/0002-workbench-cookbook.md#editor-collections) covers workspace-style editors.
- [Renderer edit and refresh](../../references/extensions/0012-renderer-edit-refresh-lifecycle.md) explains how native editors load, save, and refresh.
- [Projects and workspaces](../concepts/0001-projects-and-workspaces.md#files-and-workspaces-in-the-sidebar) describes **Files**.

*Updated at: 2026-11-22*
