import { expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbench, type WorkbenchPanelRenderInput } from "@pstdio/workbench";
import type { ReactElement } from "react";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadata, response } from "./module-test-fixtures";

// An extension install must not replace another tool's composer before its saved draft arrives.
test("keeps a native draft owner during an unrelated extension addition while hydration is pending", async () => {
  const workbench = createWorkbench();
  const projectId = "native-chat-refresh";
  const viewId = "acme.chat.view.chat";
  const nativeMetadata: WorkbenchExtensionMetadata = {
    ...emptyDashboardExtensionMetadata,
    extensions: [{ id: "acme.chat", name: "chat", displayName: "Chat", sourcePath: "" }],
    views: [
      {
        id: viewId,
        localId: "chat",
        extensionId: "acme.chat",
        title: "Chat",
        body: {
          kind: "chat",
          draftKey: "draft",
          queryHandlerId: "chat.query",
          actionHandlerId: "chat.action",
          loadDraftHandlerId: "chat.load",
          saveDraftHandlerId: "chat.save",
        },
      },
    ],
  };
  let currentMetadata = nativeMetadata;
  const loaded = Promise.withResolvers<void>();
  const refreshing = Promise.withResolvers<void>();
  let queryRead = loaded;
  const calls: string[] = [];
  const saved: unknown[] = [];
  const signals: AbortSignal[] = [];
  selectDashboardProject(workbench, { id: projectId, name: "Native chat refresh" });
  const extensions = workbench.registerModule(
    createExtensionsModule({
      loadAppearance: async () => emptyAppearance,
      loadMetadata: async () => currentMetadata,
      executeCommand: async (_project, id, body, signal) => {
        calls.push(id);
        let value: unknown = {};
        if (id === "chat.query" || id === "chat.load") {
          if (signal) signals.push(signal);
          await (id === "chat.query" ? queryRead : loaded).promise;
          value = id === "chat.load" ? { text: "Earlier saved work", attachments: [], values: {} } : {};
        } else if (id === "chat.save") saved.push(body.params?.draft);
        return {
          ...response,
          commandId: id,
          extensionId: "acme.chat",
          outcome: { ok: true, status: "success", value },
        };
      },
    }),
  );
  const writer = getWriter("extension_instances");
  const renderInput: WorkbenchPanelRenderInput = {
    workbench,
    instance: { instanceId: "compose", panelId: viewId, closable: true },
    panel: { id: viewId, title: "Chat", region: "main", rendererId: viewId },
    refresh() {},
  };
  // The session interface is intentionally accessed through the native element, as the browser does.
  type Session = {
    query: { invalidate(): void };
    retain(): () => void;
    changeDraft(update: { text: string }): void;
    flushDraft(): Promise<void>;
    getSnapshot(): { draft: { text: string; recovered?: { text: string }[] } };
  };
  const render = () => {
    const body = workbench.views.getView(viewId)!.body;
    if (body.kind !== "react") throw new Error("Expected native chat");
    return body.render(renderInput) as ReactElement<{ session: Session }>;
  };
  const releases: Array<() => void> = [];
  try {
    await flushMicrotasks();
    await flushMicrotasks();
    const first = render().props.session;
    releases.push(first.retain());
    first.changeDraft({ text: "Unsent native draft" });
    // Match the trace: add a new tool without changing any existing declaration.
    currentMetadata = {
      ...metadata,
      extensions: [...nativeMetadata.extensions, ...metadata.extensions],
      views: [...nativeMetadata.views, ...metadata.views],
    };
    writer?.upsert({ id: projectId });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(render().props.session).toBe(first);
    expect(calls.filter((id) => id === "chat.query")).toHaveLength(1);
    expect(calls.filter((id) => id === "chat.load")).toHaveLength(1);
    expect(signals.every((signal) => !signal.aborted)).toBe(true);
    loaded.resolve();
    await first.flushDraft();
    expect(first.getSnapshot().draft).toMatchObject({
      text: "Unsent native draft",
      recovered: [{ text: "Earlier saved work" }],
    });
    expect(saved.at(-1)).toMatchObject(first.getSnapshot().draft);
    // Only unfinished reads need cancellation; completed reads keep their settled signal.
    queryRead = refreshing;
    first.query.invalidate();
    await flushMicrotasks();
    expect(signals).toHaveLength(2);
    expect(signals[1].aborted).toBe(false);
    // Explicit removal still closes its reads, and re-enabling creates a fresh owner.
    currentMetadata = metadata;
    writer?.upsert({ id: projectId, enabled: false });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(workbench.views.getView(viewId)).toBeUndefined();
    expect(signals[0].aborted).toBe(false);
    expect(signals.slice(1).every((signal) => signal.aborted)).toBe(true);
    currentMetadata = nativeMetadata;
    writer?.upsert({ id: projectId, enabled: true });
    await flushMicrotasks();
    await flushMicrotasks();
    const reenabled = render().props.session;
    expect(reenabled).not.toBe(first);
    releases.push(reenabled.retain());
    currentMetadata = {
      ...nativeMetadata,
      views: nativeMetadata.views.map((view) => ({ ...view, title: "Changed chat declaration" })),
    };
    writer?.upsert({ id: projectId, revision: 2 });
    await flushMicrotasks();
    await flushMicrotasks();
    const changed = render().props.session;
    expect(changed).not.toBe(reenabled);
    releases.push(changed.retain());
    selectDashboardProject(workbench, { id: "another-chat-project", name: "Other project" });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(render().props.session).not.toBe(changed);
    expect(signals[0].aborted).toBe(false);
    expect(signals.slice(1).every((signal) => signal.aborted)).toBe(true);
  } finally {
    loaded.resolve();
    refreshing.resolve();
    for (const release of releases) release();
    extensions.dispose();
    writer?.remove(projectId);
    await workbench.dispose();
  }
});
