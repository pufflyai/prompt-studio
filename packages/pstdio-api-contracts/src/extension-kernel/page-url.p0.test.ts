import { expect, test } from "bun:test";
import { defaultPageResourceCodec } from "./page-resource-codec";
import { type PageUrlDefinition, parseWorkbenchPageUrl, serializeWorkbenchPageUrl } from "./page-url";

test("host Extensions and extension-owned pages keep distinct round-trip URLs", () => {
  const pages: PageUrlDefinition[] = [
    { id: "extensions", ref: { kind: "page", extensionId: "pstdio", id: "extensions" }, path: "extensions" },
    { id: "tools", ref: { kind: "page", extensionId: "acme.tools", id: "tools" }, path: "tools" },
  ];
  for (const [index, path] of ["extensions", "extensions/acme.tools/tools"].entries()) {
    const page = pages[index]!;
    const url = serializeWorkbenchPageUrl({
      projectId: "project-1",
      location: { page: page.ref },
      pages,
      resources: defaultPageResourceCodec,
    });
    expect(url).toBe(`/projects/project-1/${path}`);
    expect(parseWorkbenchPageUrl({ url, projectId: "project-1", pages, resources: defaultPageResourceCodec })).toEqual({
      pageId: page.id,
    });
  }
});
