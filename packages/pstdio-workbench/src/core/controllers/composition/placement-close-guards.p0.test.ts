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

test("ordinary close drains an editor that replaces its loading predecessor before acknowledgement", async () => {
  const { workbench, placement, identity } = fixture();
  const first = Promise.withResolvers<void>();
  const replacement = Promise.withResolvers<void>();
  const replacementEntered = Promise.withResolvers<void>();
  const releaseFirst = registerPlacementCloseGuard(workbench, identity, () => first.promise);
  const closing = workbench.closePlacement(identity);
  releaseFirst();
  registerPlacementCloseGuard(workbench, identity, () => {
    replacementEntered.resolve();
    return replacement.promise;
  });
  first.resolve();
  await Promise.race([replacementEntered.promise, closing]);
  expect(workbench.layout.getLayout().regions.main.widgets.some((item) => item.widgetId === placement.instanceId)).toBe(
    true,
  );
  replacement.resolve();
  await closing;
  expect(workbench.layout.getLayout().regions.main.widgets.some((item) => item.widgetId === placement.instanceId)).toBe(
    false,
  );
});

test("draining close guards never prepares a new viewer reusing the original identity", async () => {
  const { workbench, identity } = fixture();
  const acknowledged = Promise.withResolvers<void>();
  registerPlacementCloseGuard(workbench, identity, () => acknowledged.promise);
  const closing = workbench.closePlacement(identity);
  workbench.pageLocations.closePlacement(identity);
  workbench.navigation.openTarget(openFile("document"));
  const replacement = workbench.layout.getActivePanel("main")!;
  let prepared = false;
  registerPlacementCloseGuard(workbench, replacement.placementIdentity!, async () => {
    prepared = true;
  });
  acknowledged.resolve();
  await closing;
  expect(prepared).toBe(false);
  expect(workbench.layout.getActivePanel("main")?.instanceId).toBe(replacement.instanceId);
});
