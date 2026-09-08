import { describe, expect, test } from "bun:test";
import { parsePageUrl, serializePageUrl } from "./page-url";

const page = {
  id: "artifact",
  ref: { kind: "page" as const, id: "artifact", extensionId: "pstdio.pstdio-artifacts" },
  path: "artifacts/view",
};
const resource = {
  type: "artifact",
  id: "first / page",
  extensionId: page.ref.extensionId,
  projectId: "project one",
};

describe("extension page URLs", () => {
  test("round trips a resource through the dashboard route without losing ownership", () => {
    const url = serializePageUrl({ projectId: resource.projectId, page, resource });
    expect(url).toStartWith("/projects/project%20one/extensions/pstdio.pstdio-artifacts/artifacts/view?");
    expect(parsePageUrl({ url, projectId: resource.projectId, pages: [page] })).toEqual({
      pageId: page.id,
      resource,
    });
  });

  test("does not resolve another project's page or a malformed resource", () => {
    const url = serializePageUrl({ projectId: resource.projectId, page, resource });
    expect(parsePageUrl({ url, projectId: "other", pages: [page] })).toBeUndefined();
    expect(
      parsePageUrl({ url: `${url.split("?")[0]}?resource=invalid`, projectId: resource.projectId, pages: [page] }),
    ).toBeUndefined();
  });

  test("accepts only root-relative URLs for extension callers", () => {
    const url = serializePageUrl({ projectId: resource.projectId, page, resource });
    for (const input of [`https://example.test${url}`, `//example.test${url}`, url.slice(1)]) {
      expect(parsePageUrl({ url: input, projectId: resource.projectId, pages: [page] })).toBeUndefined();
    }
    expect(parsePageUrl({ url, projectId: resource.projectId, pages: [] })).toBeUndefined();
  });
});
