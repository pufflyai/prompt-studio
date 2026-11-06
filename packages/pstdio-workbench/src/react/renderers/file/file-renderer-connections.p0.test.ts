import { expect, test } from "bun:test";
import { createClient } from "@pstdio/sdk/client";
import { harness, navigate, openFile } from "../../../core/controllers/composition/placement-lifecycle-test-support";
import { createNativeDocumentSession } from "../../../core/native-documents/native-document-session";
import { getWorkbenchRenderers } from "../../../core/workbench-renderers";
import { createNativeTextPresentation } from "../../../extensions/bridge/native-text-presentation";
import { getNativeMarkdownConnection, getPublicMarkdownConnection } from "./file-renderer-connections";

test("a legacy Markdown declaration selects the public presentation without losing its captured target", async () => {
  const workbench = harness();
  workbench.navigation.openTarget(navigate("workspace"));
  workbench.navigation.openTarget(openFile("document"));
  const placement = workbench.layout.getActivePanel("main")!;
  const input = { workbench, panel: workbench.layout.getPanel(placement.panelId)!, instance: placement, refresh() {} };
  const pageParams = { section: "body" };
  const captured: unknown[] = [];
  const renderers = getWorkbenchRenderers(workbench);
  renderers.registerFileRenderer({
    id: "example.notes.view.document",
    title: "Document",
    load: () => ({}),
    save() {},
    connectText(input, pageParams) {
      captured.push({ input, pageParams });
      return createNativeTextPresentation({
        workbench,
        placement: input.instance,
        projectId: "project",
        textTarget: { fileRendererId: "example.notes.view.document", resource: placement.resource, pageParams },
        textEditing: createClient({ baseUrl: "http://localhost" }).textEditing,
      });
    },
  });
  try {
    const contribution = renderers.getFileRenderer("example.notes.view.document")!;
    const loaded = {
      content: "# Complete source",
      fileName: "note.md",
      documentSource: { kind: "workspace" as const, path: "note.md" },
      loadKey: "document",
      editorRevision: 1,
    };
    const connect = getPublicMarkdownConnection(contribution, loaded, input, pageParams);
    expect(connect).toBeFunction();
    await connect!().close();
    expect(captured).toEqual([{ input, pageParams }]);
    expect(
      getPublicMarkdownConnection(contribution, { ...loaded, editable: false }, input, pageParams),
    ).toBeUndefined();
    expect(
      getPublicMarkdownConnection({ ...contribution, saveMode: "manual" }, loaded, input, pageParams),
    ).toBeUndefined();
    expect(
      getPublicMarkdownConnection(contribution, { ...loaded, fileName: "note.ts" }, input, pageParams),
    ).toBeUndefined();
    const fallback = createNativeDocumentSession({
      projectId: "project",
      target: { fileRendererId: contribution.id, resource: placement.resource },
      client: createClient({ baseUrl: "http://localhost" }).nativeDocuments,
    });
    expect(
      getNativeMarkdownConnection(
        { ...contribution, connectText: undefined, connectDocument: () => fallback },
        loaded,
        placement.resource,
        pageParams,
      )!(),
    ).toBe(fallback);
    await fallback.close();
  } finally {
    await workbench.dispose();
  }
});
