import { describe, expect, test } from "bun:test";
import {
  createBrowserPreviewResource,
  normalizeBrowserPreviewMetadata,
  updateBrowserPreviewResource,
} from "./browser-preview-resource";

describe("browser preview resources", () => {
  test("creates unique project-scoped preview resources", () => {
    const first = createBrowserPreviewResource({ projectId: "project-a", previewId: "one" });
    const second = createBrowserPreviewResource({ projectId: "project-a", previewId: "two" });

    expect(first).toMatchObject({
      kind: "browser-preview",
      id: "one",
      uri: "dashboard-workbench://browser-preview/project-a/one",
      metadata: { projectId: "project-a", previewId: "one", viewport: { mode: "responsive" } },
    });
    expect(second.uri).not.toBe(first.uri);
  });

  test("normalizes persisted metadata", () => {
    expect(
      normalizeBrowserPreviewMetadata({
        projectId: "project-a",
        previewId: "one",
        url: "https://example.test/",
        viewport: { mode: "custom", width: 10000, height: 10 },
      }),
    ).toEqual({
      projectId: "project-a",
      previewId: "one",
      url: "https://example.test/",
      viewport: { mode: "custom", width: 1600, height: 240 },
    });
  });

  test("drops persisted addresses that do not satisfy the current URL policy", () => {
    const metadata = {
      projectId: "project-a",
      previewId: "one",
      viewport: { mode: "responsive" },
    } as const;

    expect(normalizeBrowserPreviewMetadata({ ...metadata, url: "file:///tmp/index.html" })).toEqual(metadata);
    expect(
      normalizeBrowserPreviewMetadata(
        { ...metadata, url: "http://127.0.0.1:19840/v1/projects" },
        { apiOrigin: "http://localhost:19840" },
      ),
    ).toEqual(metadata);
  });

  test("updates metadata without changing identity", () => {
    const resource = createBrowserPreviewResource({ projectId: "project-a", previewId: "one" });

    expect(
      updateBrowserPreviewResource(resource, {
        url: "https://example.test/",
        viewport: { mode: "mobile" },
      }),
    ).toMatchObject({
      id: "one",
      uri: "dashboard-workbench://browser-preview/project-a/one",
      metadata: {
        projectId: "project-a",
        previewId: "one",
        url: "https://example.test/",
        viewport: { mode: "mobile" },
      },
    });
  });
});
