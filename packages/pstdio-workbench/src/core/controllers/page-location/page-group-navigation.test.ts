import { expect, test } from "bun:test";
import type { PageLocation } from "@pstdio/sdk/extensions";
import { createPageLocationHarness, pageRef, ticketRef } from "./page-location-controller.test-support";
import { workbenchPageLocationRouteKey } from "./page-location-normalization";

test("a saved group URL keeps contextual ancestry when opening its default child", () => {
  const harness = createPageLocationHarness();
  const group = pageRef("acme.messages", "messages");
  const child = pageRef("acme.messages", "compose");
  harness.registry.registerPage({
    id: "messages",
    ref: group,
    path: "messages",
    modeId: "project",
    params: { filter: { type: "string", default: "all" } },
    main: { kind: "group", default: child },
    slots: [],
  });
  harness.registry.registerPage({
    id: "compose",
    ref: child,
    path: "compose",
    modeId: "project",
    parentId: "messages",
    main: { kind: "view", presentation: "page", cardinality: "one", view: { kind: "view", id: "compose" } },
    slots: [],
  });
  const location: PageLocation = {
    page: group,
    params: { filter: "saved" },
    parent: { page: ticketRef, resource: { type: "ticket", id: "PS-1" } },
  };
  const routeKey = workbenchPageLocationRouteKey(location, {
    normalize: (resource) => resource,
    toUri: () => "",
    fromUri: () => undefined,
  });
  harness.browser.pop({
    url: "/projects/p1/extensions/acme.messages/messages?filter=url",
    state: { kind: "pstdio.page-location", projectId: "p1", index: 1, routeKey, location },
  });
  expect(harness.controller.boot("p1")).toMatchObject({
    ok: true,
    location: {
      page: child,
      parent: { page: group, params: { filter: "url" }, parent: { page: ticketRef, resource: { id: "PS-1" } } },
    },
  });
  expect(harness.browser.replacements).toHaveLength(1);
  expect(harness.browser.pushes).toHaveLength(0);
});
