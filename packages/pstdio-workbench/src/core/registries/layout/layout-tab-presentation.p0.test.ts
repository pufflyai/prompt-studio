import { expect, test } from "bun:test";
import { createLayoutModel } from "./layout-model";
import { cacheLayoutData, restoreLayoutPresentation } from "./layout-tab-presentation";
import { createDefaultWorkbenchLayout } from "./layout-types";

const layoutWithTab = () => {
  const layout = createDefaultWorkbenchLayout();
  const registered = { getSnapshot: () => ({ label: "Registered" }) };
  const override = { getSnapshot: () => ({ label: "Override" }) };
  layout.regions.main.widgets.push({ widgetId: "session", contributionId: "sessions", tab: override });
  return { layout, registered, override };
};

test("live placement tab overrides survive an in-memory snapshot", () => {
  const { layout, registered, override } = layoutWithTab();
  const restored = restoreLayoutPresentation(layout, () => registered);
  expect(restored.regions.main.widgets[0]?.tab).toBe(override);
  expect(restored).toBe(layout);
});

test("retired providers reconnect to the live contribution, while retired registrations stay detached", () => {
  const { layout, registered } = layoutWithTab();
  const retired = { getSnapshot: () => ({ label: "Retired" }), isDisposed: () => true };
  layout.regions.main.widgets[0].tab = retired;
  const restored = restoreLayoutPresentation(layout, () => registered);
  expect(
    restored.regions.main.widgets[0]?.tab?.getSnapshot({ instanceId: "session", panelId: "sessions", closable: true })
      .label,
  ).toBe("Registered");
  expect(restored.regions.side).toBe(layout.regions.side);
  expect(restoreLayoutPresentation(restored, () => registered)).toBe(restored);
  expect(restoreLayoutPresentation(layout, () => retired).regions.main.widgets[0]?.tab).toBeUndefined();
});

test("JSON layouts omit runtime tab providers and restore the current contribution", () => {
  const { layout, registered } = layoutWithTab();
  const cached = JSON.parse(JSON.stringify(cacheLayoutData(layout)));
  expect(cached.regions.main.widgets[0].tab).toBeUndefined();
  const restored = restoreLayoutPresentation(cached, () => registered);
  expect(restored.regions.main.widgets[0]?.tab).toBe(registered);
});

test("older JSON snapshots restore their tab provider from the registered contribution", () => {
  const { layout, registered } = layoutWithTab();
  const cached = JSON.parse(JSON.stringify(layout));
  const restored = restoreLayoutPresentation(cached, () => registered);
  expect(restored.regions.main.widgets[0]?.tab).toBe(registered);
});

test.each([
  "retired",
  "json",
  "override",
])("initial %s tab metadata reconnects when its contribution registers", (kind) => {
  const { layout, registered, override } = layoutWithTab();
  if (kind === "retired") layout.regions.main.widgets[0].tab = { ...override, isDisposed: () => true };
  const saved = kind === "json" ? JSON.parse(JSON.stringify(layout)) : layout;
  const model = createLayoutModel({ persistence: { getLayout: () => saved, setLayout() {} } });
  model.registerPanel({ id: "sessions", title: "Sessions", rendererId: "sessions", region: "main", tab: registered });
  const instance = model.getActivePanel("main")!;
  expect(instance.tab?.getSnapshot(instance).label).toBe(kind === "override" ? "Override" : "Registered");
});
