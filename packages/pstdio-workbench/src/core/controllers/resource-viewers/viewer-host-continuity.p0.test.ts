import { expect, test } from "bun:test";
import { createResourceViewerFixture, viewerPage, viewerResource } from "./resource-viewer-test-fixture";
import { isRetiredViewerHost, reopenViewerHost, viewerHostKey } from "./viewer-host-continuity";

test("replacement retains the current view while reopening its source creates independent view state", async () => {
  const { w } = createResourceViewerFixture();
  w.pages.registerPage({
    id: "compose",
    ref: viewerPage("compose"),
    path: "compose",
    modeId: "project",
    main: { kind: "view", presentation: "page", cardinality: "one", view: { kind: "view", id: "reader" } },
    slots: [],
  });
  await w.navigation.openPage({ page: viewerPage("compose") });
  const source = w.pages.getContent()!;
  const firstHost = viewerHostKey(w, source.widgetId);
  const replace = w.viewers.capture(source.placementIdentity!)!;
  expect(replace({ operation: "replace", page: viewerPage("reader"), resource: viewerResource("first") })).toBe(
    "changed",
  );
  const first = w.pages.getContent()!;
  expect(viewerHostKey(w, first.widgetId)).toBe(firstHost);
  expect(isRetiredViewerHost(w, source.widgetId)).toBe(true);

  await w.navigation.openPage({ page: viewerPage("compose") });
  reopenViewerHost(w, source.widgetId);
  const secondHost = viewerHostKey(w, source.widgetId);
  expect(secondHost).not.toBe(firstHost);
  const next = w.viewers.capture(w.pages.getContent()!.placementIdentity!)!;
  expect(next({ operation: "replace", page: viewerPage("reader"), resource: viewerResource("second") })).toBe(
    "changed",
  );
  expect(viewerHostKey(w, w.pages.getContent()!.widgetId)).toBe(secondHost);
  expect(viewerHostKey(w, first.widgetId)).toBe(firstHost);
});
