import { describe, expect, test } from "bun:test";
import type { PageLocation } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import { parseWorkbenchPageUrl, serializeWorkbenchPageUrl } from "./page-location-codec";

const resources: WorkbenchPageResourceCodec = {
  normalize: (resource) => ({ ...resource, id: resource.id.toUpperCase() }),
  toUri: (resource) => `pstdio://${resource.type}/${encodeURIComponent(resource.id)}`,
  fromUri: (uri) => {
    const parsed = new URL(uri);
    const id = parsed.pathname.slice(1);
    if (parsed.protocol !== "pstdio:" || !parsed.hostname || !id) return undefined;
    return { type: parsed.hostname, id: decodeURIComponent(id) };
  },
};

const page = (id: string, extensionId: string, path: string): WorkbenchPageContribution => ({
  id,
  ref: { extensionId, kind: "page", id },
  path,
  modeId: "project",
  slots: [{ id: "content", role: "primary", region: "main", viewId: id }],
});

const pages = [
  page("start", "pstdio", ""),
  page("sessions", "pstdio", "sessions"),
  page("lab", "acme.lab", "tools/lab"),
];

describe("page location URL codec", () => {
  test("writes reserved host routes and namespaced extension routes", () => {
    const start: PageLocation = { page: pages[0]!.ref };
    const extension: PageLocation = {
      page: pages[2]!.ref,
      resource: { type: "ticket", id: "ps-326" },
      section: { anchors: [{ id: "acceptance", heading: "Acceptance" }] },
    };

    expect(serializeWorkbenchPageUrl({ projectId: "project one", location: start, pages, resources })).toBe(
      "/projects/project%20one",
    );
    expect(serializeWorkbenchPageUrl({ projectId: "project one", location: extension, pages, resources })).toBe(
      "/projects/project%20one/extensions/acme.lab/tools/lab?resource=pstdio%3A%2F%2Fticket%2FPS-326&section=%7B%22anchors%22%3A%5B%7B%22id%22%3A%22acceptance%22%2C%22heading%22%3A%22Acceptance%22%7D%5D%7D",
    );
  });

  test("parses canonical resources and sections without inventing a parent", () => {
    const result = parseWorkbenchPageUrl({
      url: "/projects/p1/extensions/acme.lab/tools/lab?resource=pstdio%3A%2F%2Fticket%2Fps-326&section=%7B%22anchors%22%3A%5B%7B%22id%22%3A%22a%22%2C%22heading%22%3A%22A%22%7D%5D%7D",
      projectId: "p1",
      pages,
      resources,
    });

    expect(result).toEqual({
      pageId: "lab",
      resource: { type: "ticket", id: "PS-326" },
      section: { anchors: [{ id: "a", heading: "A" }] },
    });
  });

  test("rejects a malformed resource URI or section", () => {
    expect(
      parseWorkbenchPageUrl({
        url: "/projects/p1/sessions?resource=not-a-resource",
        projectId: "p1",
        pages,
        resources,
      }),
    ).toBeUndefined();
    expect(
      parseWorkbenchPageUrl({
        url: "/projects/p1/sessions?section=%7B%22anchors%22%3A%5B%7B%22id%22%3A1%7D%5D%7D",
        projectId: "p1",
        pages,
        resources,
      }),
    ).toBeUndefined();
  });
});
