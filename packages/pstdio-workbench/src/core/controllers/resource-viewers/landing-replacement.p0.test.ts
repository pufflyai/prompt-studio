import { expect, test } from "bun:test";
import { createResourceViewerFixture, viewerPage, viewerResource } from "./resource-viewer-test-fixture";

test.each([
  "switch",
  "replace",
] as const)("a resource-free landing can %s its current Main content to a resource page", (operation) => {
  const { w, other } = createResourceViewerFixture();
  other();
  const identity = w.pages.getContent()!.placementIdentity!;
  expect(
    w.viewers.change(identity, {
      operation,
      page: viewerPage("reader"),
      resource: viewerResource("created"),
    }),
  ).toBe("changed");
  expect(w.pages.getContent()?.resource?.id).toBe("created");
  expect(w.pages.store.getState().location?.page).toEqual(viewerPage("reader"));
});

test("landing completion focuses an existing resource and leaves Main in its landing state", async () => {
  const { w, other, openSide, side } = createResourceViewerFixture();
  await openSide("existing");
  other();
  const identity = w.pages.getContent()!.placementIdentity!;
  expect(
    w.viewers.change(identity, {
      operation: "replace",
      page: viewerPage("reader"),
      resource: viewerResource("existing"),
    }),
  ).toBe("focused");
  expect(w.pages.store.getState().location?.page).toEqual(viewerPage("other"));
  expect(side().resource?.id).toBe("existing");
  expect(w.focus.getActiveRegion()).toBe("side");
});

test("a landing's late completion cannot navigate after its source page has gone", () => {
  const { w, other } = createResourceViewerFixture();
  other();
  const identity = w.pages.getContent()!.placementIdentity!;
  w.pageLocations.navigate({ kind: "page", page: viewerPage("home") });
  expect(
    w.viewers.change(identity, {
      operation: "replace",
      page: viewerPage("reader"),
      resource: viewerResource("created"),
    }),
  ).toBe("stale");
  expect(w.pages.store.getState().location?.page).toEqual(viewerPage("home"));
});
