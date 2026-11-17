import { describe, expect, test } from "bun:test";
import type { ProjectExtensionInstance } from "@pstdio/sdk/api";
import { findExtensionPublication } from "@/features/extensions/project-extension-selectors";
import { findPublicationSource } from "./publication";

const copy = (installName: string, enabled: boolean): ProjectExtensionInstance => ({
  id: `${installName}-instance`,
  projectId: "project-1",
  extensionId: "test.shared",
  installedExtensionId: `${installName}-source`,
  installName,
  name: "shared",
  displayName: "Shared",
  version: "1.0.0",
  sourcePath: `/repo/.pstdio/extensions/${installName}`,
  scope: "repo",
  status: enabled ? "loaded" : "disabled",
  enabled,
  config: {},
  canUpgrade: false,
  updateAvailable: false,
});

describe("extensions publication", () => {
  test("publishes the enabled copy when an older disabled copy shares the extension ID", () => {
    const active = copy("shared-new", true);
    expect(findPublicationSource([copy("shared-old", false), active], "test.shared")).toBe(active);
  });

  test("publishes the copy named by its install name", () => {
    const leftover = copy("shared-old", false);
    expect(findPublicationSource([leftover, copy("shared-new", true)], "shared-old")).toBe(leftover);
  });
});

test("publication aliases select the actual historical record key without merging histories", () => {
  const historical = { recordId: "pstdio.pstdio-notes", revision: "original-history" };
  expect(findExtensionPublication([historical], "pstdio.notes")).toBe(historical);
  expect(() => findExtensionPublication([historical, { recordId: "pstdio.notes" }], "pstdio.notes")).toThrow(
    "Conflicting extension publication histories",
  );
  expect(findExtensionPublication([{ recordId: "acme.pstdio-notes" }], "acme.notes")).toBeUndefined();
});

test("publication preserves an explicit custom qualified install name ahead of a canonical owner", () => {
  const notes = { ...copy("notes", true), extensionId: "pstdio.notes" };
  const custom = { ...copy("pstdio.notes", true), extensionId: "acme.tools" };
  expect(findPublicationSource([notes, custom], "pstdio.notes")).toBe(custom);
});
