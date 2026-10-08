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
  test("round trips a source range independently of document metadata", () => {
    const documentPage = { ...page, document: { metadataKey: "workspaceFilePath" } };
    const selected = { ...resource, metadata: { workspaceFilePath: "src/app.ts" } };
    const position = { line: 12, column: 4, endLine: 18, endColumn: 2 };
    const url = serializePageUrl({ projectId: resource.projectId, page: documentPage, resource: selected, position });
    expect(parsePageUrl({ url, projectId: resource.projectId, pages: [documentPage] })).toEqual({
      pageId: page.id,
      resource: selected,
      position,
    });
    for (const suffix of [
      "&line=0",
      "&column=2",
      "&line=1.5",
      "&line=2&endLine=1",
      "&line=2&endColumn=3",
      "&line=2&line=3",
    ]) {
      const base = serializePageUrl({ projectId: resource.projectId, page: documentPage, resource: selected });
      expect(
        parsePageUrl({ url: base + suffix, projectId: resource.projectId, pages: [documentPage] }),
      ).toBeUndefined();
    }
    const plain = serializePageUrl({ projectId: resource.projectId, page, resource });
    expect(parsePageUrl({ url: `${plain}&line=2`, projectId: resource.projectId, pages: [page] })).toBeUndefined();
  });
  test("round trips only the page's declared document metadata", () => {
    const documentPage = { ...page, document: { metadataKey: "documentId" } };
    const document = "files/文 My %#?().md";
    const selected = { ...resource, metadata: { documentId: document, secret: "private" } };
    const url = serializePageUrl({ projectId: resource.projectId, page: documentPage, resource: selected });
    expect(new URL(url, "http://test").searchParams.get("document")).toBe(document);
    expect(url).not.toContain("private");
    expect(parsePageUrl({ url, projectId: resource.projectId, pages: [documentPage] })).toEqual({
      pageId: page.id,
      resource: { ...resource, metadata: { documentId: document } },
    });
  });

  test("rejects undeclared, empty and duplicate document selectors", () => {
    const url = serializePageUrl({ projectId: resource.projectId, page, resource });
    const documentPage = { ...page, document: { metadataKey: "documentId" } };
    expect(parsePageUrl({ url: `${url}&document=a`, projectId: resource.projectId, pages: [page] })).toBeUndefined();
    for (const suffix of ["&document=", "&document=a&document=b", "&resource=invalid"]) {
      expect(
        parsePageUrl({ url: `${url}${suffix}`, projectId: resource.projectId, pages: [documentPage] }),
      ).toBeUndefined();
    }
    for (const value of ["", 1, {}]) {
      expect(() =>
        serializePageUrl({
          projectId: resource.projectId,
          page: documentPage,
          resource: { ...resource, metadata: { documentId: value } },
        }),
      ).toThrow();
    }
  });
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
