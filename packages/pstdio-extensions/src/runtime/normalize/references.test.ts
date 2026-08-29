import { describe, expect, test } from "bun:test";
import { workbenchCommands, workbenchModes, workbenchResourceKinds } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import { resolveCommandRef, resolveContributionRefId, serializeWhenExpression } from "./references";

const ext = { id: "pstdio.pstdio-planner", name: "pstdio-planner" } as NormalizedExtension;

describe("contribution ref resolution", () => {
  test("prefixes extension-owned refs with owner and kind", () => {
    expect(resolveContributionRefId(ext.id, { kind: "view", id: "tickets" })).toBe(
      "pstdio.pstdio-planner.view.tickets",
    );
    expect(resolveCommandRef(ext, { kind: "command", id: "ticket-status.read" })).toBe(
      "pstdio.pstdio-planner.command.ticket-status.read",
    );
  });

  test("resolves host-published refs to the host's registered id for every kind", () => {
    expect(resolveContributionRefId(ext.id, workbenchCommands.switchMode)).toBe("workbench.action.switchMode");
    expect(resolveContributionRefId(ext.id, workbenchModes.project)).toBe("project");
    expect(resolveContributionRefId(ext.id, { extensionId: "pstdio", kind: "view", id: "workspaces" })).toBe(
      "workspaces",
    );
  });

  test("serializes host refs in when-expressions without owner prefixing", () => {
    const when = serializeWhenExpression(
      { mode: workbenchModes.project, resourceType: [workbenchResourceKinds.workspace] },
      ext.id,
    );

    expect(when).toEqual({ mode: "project", resourceType: ["workspace"] });
  });

  test("serializes extension-owned when-refs with owner and kind", () => {
    const when = serializeWhenExpression({ mode: { kind: "mode", id: "lab" } }, "pstdio.extension-lab");

    expect(when).toEqual({ mode: "pstdio.extension-lab.mode.lab" });
  });
});
