import { expect, test } from "bun:test";
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
