import { expect, test } from "bun:test";
import { harness, navigate, openFile, panel, resource } from "./placement-lifecycle-test-support";

test.each(["page", "mode"] as const)("Keep Open pins the %s owner before another preview opens", async (owner) => {
  const workbench = harness();
  await workbench.navigation.openTarget(navigate("alpha"));
  const target = (id: string) =>
    owner === "page"
      ? openFile(id)
      : { kind: "panel" as const, panel, resource: resource(id), open: "preview" as const };
  const region = owner === "page" ? "main" : "side";
  await workbench.navigation.openTarget(target("first"));
  const first = workbench.layout.getLayout().regions[region].widgets[0]!;
  workbench.pinPlacement(first.placementIdentity!);
  await workbench.navigation.openTarget(target("second"));
  expect(
    workbench.layout.getLayout().regions[region].widgets.map((item) => [item.resource?.id, item.tabRetention]),
  ).toEqual([
    ["first", "persistent"],
    ["second", "preview"],
  ]);
});
