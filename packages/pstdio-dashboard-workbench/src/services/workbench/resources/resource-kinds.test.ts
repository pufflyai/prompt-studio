import { describe, expect, test } from "bun:test";
import {
  buildResourceUri,
  dashboardResourceKindIds,
  dashboardResourceKinds,
  parseResourceUri,
  settingsSectionResource,
  ticketResource,
  workspaceResource,
} from "./resource-kinds";

describe("resource uris", () => {
  test("builds and parses a uri round-trip", () => {
    const uri = buildResourceUri("ticket", "PS-298");
    expect(uri).toBe("pstdio-dashboard://ticket/PS-298");
    expect(parseResourceUri(uri)).toEqual({ kind: "ticket", id: "PS-298" });
  });

  test("round-trips ids that need encoding", () => {
    const uri = buildResourceUri("extension-route", "lab/repo health");
    expect(parseResourceUri(uri)).toEqual({ kind: "extension-route", id: "lab/repo health" });
  });

  test("rejects foreign uris", () => {
    expect(parseResourceUri("https://example.com/ticket/PS-1")).toBeUndefined();
    expect(parseResourceUri("pstdio-dashboard://ticket/")).toBeUndefined();
  });
});

describe("resource builders", () => {
  test("ticket resource carries kind, uri, and id", () => {
    const resource = ticketResource("PS-12", "Add button");
    expect(resource.kind).toBe(dashboardResourceKindIds.ticket);
    expect(resource.uri).toBe("pstdio-dashboard://ticket/PS-12");
    expect(resource.id).toBe("PS-12");
    expect(resource.label).toBe("Add button");
  });

  test("workspace resource encodes the active tab in metadata", () => {
    expect(workspaceResource("ws-1").metadata).toBeUndefined();
    expect(workspaceResource("ws-1", { tab: "diffs" }).metadata).toEqual({ tab: "diffs" });
  });

  test("settings section resource resolves a known section label", () => {
    expect(settingsSectionResource("repositories").label).toBe("Repositories");
    expect(settingsSectionResource("unknown").label).toBe("Settings");
  });

  test("every declared resource kind has a unique id", () => {
    const kinds = dashboardResourceKinds.map((entry) => entry.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
  });
});
