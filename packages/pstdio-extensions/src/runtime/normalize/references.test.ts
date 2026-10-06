import { describe, expect, test } from "bun:test";
import { workbenchModes, workbenchResourceKinds } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import { resolveCommandRef, serializeWhenExpression } from "./references";

const ext = { id: "pstdio.pstdio-planner", name: "pstdio-planner" } as NormalizedExtension;

describe("contribution ref resolution", () => {
  test("prefixes extension-owned command refs with owner and kind", () => {
    expect(resolveCommandRef(ext, { kind: "command", id: "ticket-status.read" })).toBe(
      "pstdio.pstdio-planner.command.ticket-status.read",
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
