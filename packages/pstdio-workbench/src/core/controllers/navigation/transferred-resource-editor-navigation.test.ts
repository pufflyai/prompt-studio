import { expect, test } from "bun:test";
import { harness, navigate, openFile, panel, resource } from "../composition/placement-lifecycle-test-support";

test.each([
  false,
  true,
])("an earlier compound pin retains a transferred editor after leaving its owner: %s", async (leaveOwner) => {
  const w = harness();
  w.views.getView("editor")!.instancePolicy = "per-resource";
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("a"));
  const a = w.layout.getLayout().regions.main.widgets.find((tab) => tab.resource?.id === "a")!;
  w.movePanel(a.widgetId, "side");
  await w.navigation.openTarget({
    kind: "compound",
    targets: [
      { ...openFile("a"), open: "pin" },
      leaveOwner ? navigate("beta") : { kind: "panel", panel, resource: resource("b"), open: "pin" },
    ],
  });
  if (leaveOwner) await w.navigation.openTarget(navigate("alpha"));
  const retained = w.layout.getLayout().regions.side.widgets.find((tab) => tab.widgetId === a.widgetId)!;
  expect(retained.pinned).toBe(true);
  expect(retained.tabRetention).toBe("persistent");
  if (!leaveOwner)
    expect(
      w.layout.getLayout().regions.side.widgets.find((tab) => tab.widgetId === w.layout.getLayout().activeWidgetId)
        ?.resource?.id,
    ).toBe("b");
});
