import { expect, test } from "bun:test";
import { createResourceViewerFixture, viewerPage, viewerResource } from "./resource-viewer-test-fixture";

test("a late draft completion cannot reopen a resource already reported as deleted", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  await openSide("draft", "draft");
  const identity = side().placementIdentity!;
  const complete = w.viewers.capture(identity)!;
  w.resources.removed(viewerResource("created"));
  expect(
    complete({
      operation: "replace",
      resource: viewerResource("created"),
    }),
  ).toBe("stale");
  expect(side().resource?.id).toBe("draft");
});

test("a fresh authoritative opening can use the identity of a recreated resource", async () => {
  const { w } = createResourceViewerFixture();
  w.resources.removed(viewerResource("deleted"));
  const target = {
    kind: "page" as const,
    page: viewerPage("reader"),
    resource: { ...viewerResource("deleted"), label: "Recreated" },
  };
  await w.navigation.openTarget(target);
  expect(w.pages.getContent()?.resource?.label).toBe("Recreated");
});
