import { expect, test } from "bun:test";
import type { CommandExecutionResult, ListExtensionAppearanceResponse } from "@pstdio/sdk/api";
import { createWorkbench, type Disposable, type WorkbenchPanelInstance } from "@pstdio/workbench";
import i18n from "@/i18n";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks, metadataWithLabMode } from "./module-test-fixtures";

const extensionId = "pstdio.extension-lab";
const placementId = metadataWithLabMode.placements[0].id;
const commandId = `${extensionId}.command.tab`;
const catalog = {
  ...metadataWithLabMode,
  placements: metadataWithLabMode.placements.map((placement) => ({ ...placement, tab: { queryHandlerId: commandId } })),
};
const translatedAppearance = (label = "New session"): ListExtensionAppearanceResponse => ({
  ...emptyAppearance,
  translations: [{ extensionId, defaultLocale: "en", bundles: { en: { label }, fr: { label: "Nouvelle session" } } }],
});
const release = (subscription: Disposable | (() => void)) =>
  typeof subscription === "function" ? subscription() : subscription.dispose();

const createHarness = (loadAppearance: (projectId: string) => Promise<ListExtensionAppearanceResponse>) => {
  const workbench = createWorkbench();
  const projectId = `tab-locale-${crypto.randomUUID()}`;
  selectDashboardProject(workbench, { id: projectId, name: "Localized tabs" });
  let reads = 0;
  let held: ReturnType<typeof Promise.withResolvers<void>> | undefined;
  const signals: AbortSignal[] = [];
  const registration = workbench.registerModule(
    createExtensionsModule({
      loadAppearance,
      loadMetadata: async () => catalog,
      executeCommand: async (_project, id, _body, signal) => {
        reads++;
        signals.push(signal!);
        await held?.promise;
        return {
          extensionId,
          commandId: id,
          outcome: {
            ok: true,
            status: "success",
            value: {
              label: { $l10n: "label", default: "Fallback" },
              menu: [{ id: "sessions", rows: [{ id: "new", label: { $l10n: "label", default: "Fallback" } }] }],
            },
          },
        } satisfies CommandExecutionResult;
      },
    }),
  );
  const instance: WorkbenchPanelInstance = {
    instanceId: "one",
    panelId: placementId,
    closable: true,
    resource: { type: "note", id: "one", extensionId, projectId },
  };
  const tab = () => workbench.modePlacements.getPlacement({ extensionId, kind: "placement", id: "lab-overview" })!.tab!;
  return {
    projectId,
    instance,
    tab,
    select: (id: string) => selectDashboardProject(workbench, { id, name: id }),
    reads: () => reads,
    signals,
    hold: () => (held = Promise.withResolvers<void>()),
    rename: () => workbench.resources.preview.begin(instance.resource!, { label: "Renamed" }).commit(),
    async dispose() {
      held?.resolve();
      registration.dispose();
      await workbench.dispose();
    },
  };
};

test("a locale change refreshes dynamic tab actions with plain-text contribution metadata and reuses the original locale", async () => {
  await i18n.changeLanguage("en");
  const harness = createHarness(async () => translatedAppearance());
  let subscription: Disposable | (() => void) | undefined;
  try {
    await flushMicrotasks();
    let tab = harness.tab();
    subscription = tab.subscribe!(() => {}, harness.instance);
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).menu?.[0]?.rows[0]?.label).toBe("New session");
    await i18n.changeLanguage("fr");
    release(subscription);
    tab = harness.tab();
    subscription = tab.subscribe!(() => {}, harness.instance);
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).menu?.[0]?.rows[0]?.label).toBe("Nouvelle session");
    await i18n.changeLanguage("en");
    release(subscription);
    tab = harness.tab();
    subscription = tab.subscribe!(() => {}, harness.instance);
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).menu?.[0]?.rows[0]?.label).toBe("New session");
    expect(harness.reads()).toBe(2);
  } finally {
    if (subscription) release(subscription);
    await harness.dispose();
    await i18n.changeLanguage("en");
  }
});

test.each([
  "locale",
  "project",
])("a preview refresh follows the tab's observation lifetime across a %s change", async (change) => {
  await i18n.changeLanguage("en");
  const harness = createHarness(async (id) => translatedAppearance(id.endsWith("-b") ? "B action" : "New session"));
  let subscription: Disposable | (() => void) | undefined;
  let held: ReturnType<typeof Promise.withResolvers<void>> | undefined;
  let preview: Promise<void> | undefined;
  try {
    await flushMicrotasks();
    let tab = harness.tab();
    subscription = tab.subscribe!(() => {}, harness.instance);
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).label).toBe("New session");
    held = harness.hold();
    preview = harness.rename();
    await flushMicrotasks();
    expect(harness.reads()).toBe(2);
    if (change === "locale") await i18n.changeLanguage("fr");
    else {
      harness.select(`${harness.projectId}-b`);
      await flushMicrotasks();
    }
    expect(harness.signals[1].aborted).toBe(true);
    release(subscription);
    tab = harness.tab();
    subscription = tab.subscribe!(() => {}, harness.instance);
    held.resolve();
    await preview;
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).label).toBe(change === "locale" ? "Nouvelle session" : "B action");
    if (change === "locale") await i18n.changeLanguage("en");
    else {
      harness.select(harness.projectId);
      await flushMicrotasks();
    }
    release(subscription);
    tab = harness.tab();
    subscription = tab.subscribe!(() => {}, harness.instance);
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).label).toBe("New session");
  } finally {
    held?.resolve();
    if (subscription) release(subscription);
    await preview;
    await harness.dispose();
    await i18n.changeLanguage("en");
  }
});

test("tab labels reconcile after delayed appearance translations and same-locale bundle replacements", async () => {
  await i18n.changeLanguage("en");
  const appearance = Promise.withResolvers<ListExtensionAppearanceResponse>();
  let next = appearance.promise;
  const harness = createHarness(() => next);
  let subscription: Disposable | (() => void) | undefined;
  const owner = getRuntimeCollections();
  const writer = owner.getWriter("extension_instances")!;
  try {
    await flushMicrotasks();
    const tab = harness.tab();
    subscription = tab.subscribe!(() => {}, harness.instance);
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).label).toBe("Fallback");
    appearance.resolve(translatedAppearance());
    await flushMicrotasks();
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).label).toBe("New session");
    const changed = Promise.withResolvers<ListExtensionAppearanceResponse>();
    next = changed.promise;
    writer.upsert({ id: harness.projectId, scope_type: "project", scope_id: harness.projectId, enabled: true });
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).label).toBe("New session");
    changed.resolve(translatedAppearance("Updated action"));
    await flushMicrotasks();
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).label).toBe("Updated action");
    next = Promise.resolve(emptyAppearance);
    writer.upsert({ id: harness.projectId, scope_type: "project", scope_id: harness.projectId, enabled: false });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).label).toBe("Fallback");
  } finally {
    appearance.resolve(translatedAppearance());
    if (subscription) release(subscription);
    await harness.dispose();
    writer.remove(harness.projectId);
    await i18n.changeLanguage("en");
  }
});

test("different project bundles preserve unchanged warm tab results across A/B/A", async () => {
  await i18n.changeLanguage("en");
  const harness = createHarness(async (id) => translatedAppearance(id.endsWith("-b") ? "B action" : "A action"));
  let subscription: Disposable | (() => void) | undefined;
  try {
    await flushMicrotasks();
    let tab = harness.tab();
    subscription = tab.subscribe!(() => {}, harness.instance);
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).label).toBe("A action");
    release(subscription);
    harness.select(`${harness.projectId}-b`);
    await flushMicrotasks();
    tab = harness.tab();
    subscription = tab.subscribe!(() => {}, harness.instance);
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).label).toBe("B action");
    release(subscription);
    harness.select(harness.projectId);
    await flushMicrotasks();
    tab = harness.tab();
    subscription = tab.subscribe!(() => {}, harness.instance);
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).label).toBe("A action");
    expect(harness.reads()).toBe(2);
  } finally {
    if (subscription) release(subscription);
    await harness.dispose();
    await i18n.changeLanguage("en");
  }
});

test.each([
  "accepted",
  "pending",
])("an old locale's delayed result cannot populate that locale's retained tab with %s appearance", async (state) => {
  await i18n.changeLanguage("en");
  const appearance = Promise.withResolvers<ListExtensionAppearanceResponse>();
  const harness = createHarness(() =>
    state === "accepted" ? Promise.resolve(translatedAppearance()) : appearance.promise,
  );
  let subscription: Disposable | (() => void) | undefined;
  const held = harness.hold();
  try {
    await flushMicrotasks();
    let tab = harness.tab();
    subscription = tab.subscribe!(() => {}, harness.instance);
    await flushMicrotasks();
    expect(harness.reads()).toBe(1);
    await i18n.changeLanguage("fr");
    expect(harness.signals[0].aborted).toBe(true);
    release(subscription);
    tab = harness.tab();
    subscription = tab.subscribe!(() => {}, harness.instance);
    appearance.resolve(translatedAppearance());
    held.resolve();
    await flushMicrotasks();
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).label).toBe("Nouvelle session");
    await i18n.changeLanguage("en");
    release(subscription);
    tab = harness.tab();
    subscription = tab.subscribe!(() => {}, harness.instance);
    await flushMicrotasks();
    expect(tab.getSnapshot(harness.instance).label).toBe("New session");
  } finally {
    appearance.resolve(translatedAppearance());
    held.resolve();
    if (subscription) release(subscription);
    await harness.dispose();
    await i18n.changeLanguage("en");
  }
});
