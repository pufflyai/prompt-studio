import { expect, test } from "bun:test";
import { defaultPageResourceCodec } from "pstdio-api-contracts";
import type { WorkbenchPageContribution } from "./page-registry-types";
import { ownsStaticPageInstance, pageStateKey, staticPageInstanceKey } from "./page-state-key";

test("static page views use the document identity across section and parent changes", () => {
  const page: WorkbenchPageContribution = {
    id: "file",
    ref: { kind: "page", extensionId: "test", id: "file" },
    path: "file",
    modeId: "project",
    resource: { kinds: [{ kind: "resource-kind", id: "workspace" }] },
    document: { metadataKey: "file" },
    main: { kind: "panels", empty: { kind: "view", id: "file" } },
    slots: [],
  };
  const resource = { type: "workspace", id: "one", metadata: { file: "a.ts" } };
  const owner = staticPageInstanceKey(page, resource, defaultPageResourceCodec);
  const other = staticPageInstanceKey(page, { ...resource, metadata: { file: "b.ts" } }, defaultPageResourceCodec);
  expect(owner).not.toBe(other);
  for (const section of ["one", "two"]) {
    const key = pageStateKey(
      page,
      { page: page.ref, resource, section: { anchors: [{ id: section, heading: section }] } },
      defaultPageResourceCodec,
    );
    expect(ownsStaticPageInstance(key, page.id, owner)).toBe(true);
    expect(ownsStaticPageInstance(key, page.id, other)).toBe(false);
  }
});
