import { expect, test } from "bun:test";
import { createScopedQueryClient, viewDataEvents } from "@pstdio/sdk/extensions";
import { createWorkbench, type Disposable, type WorkbenchPanelInstance } from "../../core";
import { emptyWorkbenchExtensionMetadata } from "../contributions/extension-contributions";
import { createWorkbenchExtensionTabPresentation } from "./workbench-extension-tab-presentation";

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
const instance: WorkbenchPanelInstance = {
  instanceId: "conversation",
  panelId: "conversation",
  closable: true,
  resource: { type: "session", id: "one" },
};
const metadata = { extensionId: "sessions", placementId: "conversation", queryHandlerId: "title" };
const release = (subscription: Disposable | (() => void)) =>
  typeof subscription === "function" ? subscription() : subscription.dispose();

test("localized tab actions use their locale and reuse the accepted original locale on return", async () => {
  const workbench = createWorkbench();
  const queries = createScopedQueryClient({ runtimeId: "tab-locales", extensionId: "pstdio" });
  const reads: string[] = [];
  const create = (presentationLocale: string) =>
    createWorkbenchExtensionTabPresentation(
      {
        workbench,
        queries,
        projectId: "project",
        presentationLocale,
        metadata: emptyWorkbenchExtensionMetadata,
        executeCommand: async () => {
          reads.push(presentationLocale);
          return { menu: [{ id: "sessions", rows: [{ id: "new", label: presentationLocale }] }] };
        },
      },
      metadata,
    );
  let tab = create("en");
  let subscription = tab.subscribe!(() => {}, instance);
  try {
    await settle();
    expect(tab.getSnapshot(instance).menu?.[0]?.rows[0]?.label).toBe("en");
    release(subscription);
    tab.dispose();
    tab = create("fr");
    subscription = tab.subscribe!(() => {}, instance);
    await settle();
    expect(tab.getSnapshot(instance).menu?.[0]?.rows[0]?.label).toBe("fr");
    release(subscription);
    tab.dispose();
    tab = create("en");
    subscription = tab.subscribe!(() => {}, instance);
    await settle();
    expect(tab.getSnapshot(instance).menu?.[0]?.rows[0]?.label).toBe("en");
    expect(reads).toEqual(["en", "fr"]);
  } finally {
    release(subscription);
    tab.dispose();
    queries.dispose();
    await workbench.dispose();
  }
});

test("catalog changes refresh matching visible tabs and catch up inactive tabs without reading other projects", async () => {
  const workbench = createWorkbench();
  const queries = createScopedQueryClient({ runtimeId: "tab-catalog", extensionId: "pstdio" });
  const reads: string[] = [];
  const tabs = ["a", "b", "c"].map((projectId) =>
    createWorkbenchExtensionTabPresentation(
      {
        workbench,
        queries,
        projectId,
        metadata: emptyWorkbenchExtensionMetadata,
        executeCommand: async () => ({ label: `${projectId}:${reads.push(projectId)}` }),
      },
      metadata,
    ),
  );
  const subscriptions = tabs.map((tab) => tab.subscribe!(() => {}, instance));
  try {
    await settle();
    release(subscriptions[1]);
    reads.length = 0;
    queries.invalidate({ type: "changed", id: viewDataEvents.extensionCatalogChanged.id, projectId: "b" });
    await settle();
    expect(reads).toEqual([]);
    queries.invalidate({ type: "changed", id: viewDataEvents.extensionCatalogChanged.id, projectId: "a" });
    await settle();
    expect(reads).toEqual(["a"]);
    subscriptions[1] = tabs[1].subscribe!(() => {}, instance);
    await settle();
    expect(reads).toEqual(["a", "b"]);
    expect(tabs[1].getSnapshot(instance).label).toBe("b:2");
    queries.invalidate({
      type: "changed",
      id: viewDataEvents.extensionTranslationsChanged.id,
      projectId: "a",
      extensionId: "other",
    });
    await settle();
    expect(reads).toEqual(["a", "b"]);
    queries.invalidate({
      type: "changed",
      id: viewDataEvents.extensionTranslationsChanged.id,
      projectId: "a",
      extensionId: "sessions",
    });
    await settle();
    expect(reads).toEqual(["a", "b", "a"]);
  } finally {
    subscriptions.forEach(release);
    for (const tab of tabs) tab.dispose();
    queries.dispose();
    await workbench.dispose();
  }
});
