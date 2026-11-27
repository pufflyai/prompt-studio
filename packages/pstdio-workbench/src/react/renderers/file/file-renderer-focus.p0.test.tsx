import { expect, test } from "bun:test";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createWorkbench, type RegisteredFileRendererContribution } from "../../../core";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { FileRendererContentView, type FileRendererContentViewProps } from "./file-renderer-content";
import { WorkbenchFileRendererView } from "./file-renderer-view";

test("the file renderer grants focus once per open document across content refreshes", async () => {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  const workbench = createWorkbench();
  workbench.focus.setActiveRegion("main");
  let content = "Original content";
  const contribution: RegisteredFileRendererContribution = {
    id: "markdown-file",
    title: "Markdown file",
    source: "extension",
    ownerId: "acme.docs",
    priority: 0,
    saveMode: "manual",
    // Exercise the renderer's handoff without mounting the browser-only editor.
    load: () => ({ fileName: "document.md", content, emptyState: { title: "Document" } }),
  };
  const panel = { id: "document", title: "Document", region: "main", rendererId: contribution.id } as const;
  const region = { getAttribute: () => "main" };
  const document = { body: {}, activeElement: {} };
  const view = (id: string) => {
    const instance = { instanceId: "document", panelId: panel.id, resource: { type: "file", id }, closable: true };
    return (
      <WorkbenchThemeProvider>
        <WorkbenchFileRendererView
          workbench={workbench}
          contribution={contribution}
          placement={instance}
          presentationInput={{ workbench, panel, instance, viewId: "document", refresh: () => {} }}
        />
      </WorkbenchThemeProvider>
    );
  };
  const editor = { closest: () => region, ownerDocument: document } as unknown as HTMLElement;
  let tree: ReactTestRenderer | undefined;
  const editorProps = () => tree!.root.findByType(FileRendererContentView).props as FileRendererContentViewProps;
  try {
    await act(async () => {
      tree = create(view("first"));
    });
    const initial = editorProps();
    expect(initial.content?.content).toBe("Original content");
    expect(initial.focusOnOpen?.(editor)).toBe(false);

    document.activeElement = document.body;
    content = "Refreshed content";
    await act(async () => workbench.views.reads.invalidate(contribution.id));
    const refreshed = editorProps();
    expect(refreshed.content?.content).toBe("Refreshed content");
    expect(refreshed.editorKey).not.toBe(initial.editorKey);
    expect(refreshed.focusOnOpen?.(editor)).toBe(false);

    await act(async () => tree!.update(view("second")));
    expect(editorProps().focusOnOpen?.(editor)).toBe(true);
  } finally {
    await act(async () => tree?.unmount());
    await workbench.dispose();
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
