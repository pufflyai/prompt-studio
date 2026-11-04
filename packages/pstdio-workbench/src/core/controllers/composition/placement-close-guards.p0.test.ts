import { expect, test } from "bun:test";
import { registerPlacementCloseGuard } from "./placement-close-guards";
import { harness, navigate, openFile } from "./placement-lifecycle-test-support";

const fixture = () => {
  const workbench = harness();
  workbench.navigation.openTarget(navigate("workspace"));
  workbench.navigation.openTarget(openFile("document"));
  const placement = workbench.layout.getActivePanel("main")!;
  return { workbench, placement, identity: placement.placementIdentity! };
};

test("ordinary close retains a text placement until its host close barrier acknowledges", async () => {
  const { workbench, placement, identity } = fixture();
  const acknowledged = Promise.withResolvers<void>();
  registerPlacementCloseGuard(workbench, identity, () => acknowledged.promise);
  const closing = workbench.closePlacement(identity);
  expect(workbench.layout.getLayout().regions.main.widgets.some((item) => item.widgetId === placement.instanceId)).toBe(
    true,
  );
  acknowledged.resolve();
  await closing;
  expect(workbench.layout.getLayout().regions.main.widgets.some((item) => item.widgetId === placement.instanceId)).toBe(
    false,
  );
});

test("a refused close barrier keeps its placement available for recovery", async () => {
  const { workbench, placement, identity } = fixture();
  const refused = Promise.withResolvers<void>();
  const unregister = registerPlacementCloseGuard(workbench, identity, () => refused.promise);
  const closing = workbench.closePlacement(identity);
  refused.reject(new Error("Finish the active draft"));
  await expect(closing).rejects.toThrow("Finish the active draft");
  expect(workbench.layout.getLayout().regions.main.widgets.some((item) => item.widgetId === placement.instanceId)).toBe(
    true,
  );
  unregister();
  await workbench.closePlacement(identity);
  expect(workbench.layout.getLayout().regions.main.widgets.some((item) => item.widgetId === placement.instanceId)).toBe(
    false,
  );
});

test("a late close acknowledgement cannot close a replacement using the same placement identity", async () => {
  const { workbench, identity } = fixture();
  const acknowledged = Promise.withResolvers<void>();
  registerPlacementCloseGuard(workbench, identity, () => acknowledged.promise);
  const closing = workbench.closePlacement(identity);
  workbench.pageLocations.closePlacement(identity);
  workbench.navigation.openTarget(openFile("document"));
  const replacement = workbench.layout.getActivePanel("main")!;
  acknowledged.resolve();
  await closing;
  expect(workbench.layout.getActivePanel("main")?.instanceId).toBe(replacement.instanceId);
});
