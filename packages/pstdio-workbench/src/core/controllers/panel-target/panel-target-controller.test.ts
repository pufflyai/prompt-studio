import { describe, expect, test } from "bun:test";
import type { NavigationTargetPanel } from "@pstdio/sdk/extensions";
import {
  createHarness,
  sessionsInspectorRef,
  sessionsRef,
  sessionTarget,
  startRef,
  ticketRef,
} from "./panel-target-controller.test-support";

describe("workbench panel target controller", () => {
  test("opens an attached mode session without changing page location or browser history", () => {
    const harness = createHarness();
    const before = harness.registry.store.getState().location;
    const pushCount = harness.pushes.length;
    const replaceCount = harness.replacements.length;

    const result = harness.panels.open(sessionTarget());

    expect(result).toMatchObject({ ok: true });
    const state = harness.registry.store.getState();
    expect(state.location).toBe(before);
    expect(harness.pushes).toHaveLength(pushCount);
    expect(harness.replacements).toHaveLength(replaceCount);
    expect(harness.saved.get("p1")).toBe(before);
    expect(state.placements.map((candidate) => candidate.value)).toEqual([
      "ticket:content:PS-326",
      "session:S-1:preview",
      "mode:project",
    ]);
    expect(state.reconciliation.activate[0]?.identity).toEqual({
      kind: "mode",
      modeId: "project",
      placementId: "project-session",
      instanceKey: "session:S-1",
    });
  });

  test("retains an attached session across project pages and removes it on a mode change", () => {
    const harness = createHarness();
    harness.panels.open(sessionTarget());

    harness.location.navigate({ kind: "page", page: startRef });
    expect(harness.registry.store.getState().placements.map((candidate) => candidate.value)).toContain(
      "session:S-1:preview",
    );

    harness.location.navigate({
      kind: "page",
      page: sessionsRef,
      resource: { type: "session", id: "S-1" },
    });
    const state = harness.registry.store.getState();
    expect(state.activeModeId).toBe("sessions");
    expect(state.placements.map((candidate) => candidate.value)).toEqual(["sessions:content:S-1", "mode:sessions"]);
    expect(state.reconciliation.remove.map((candidate) => candidate.value)).toContain("session:S-1:preview");
  });

  test("resolves a panel against the destination mode in the page transaction", () => {
    const harness = createHarness();
    let stateChanges = 0;
    const unsubscribe = harness.registry.store.subscribe(() => {
      stateChanges += 1;
    });

    const result = harness.location.navigateWithPanels(
      {
        kind: "page",
        page: sessionsRef,
        resource: { type: "session", id: "S-1" },
      },
      [sessionTarget(sessionsInspectorRef)],
    );

    unsubscribe();
    expect(result.ok).toBe(true);
    const state = harness.registry.store.getState();
    expect(stateChanges).toBe(1);
    expect(state.activeModeId).toBe("sessions");
    expect(state.placements.map((candidate) => candidate.value)).toEqual([
      "sessions:content:S-1",
      "session:S-1:preview",
      "mode:sessions",
    ]);
  });

  test("opens an active page auxiliary slot without changing its primary location", () => {
    const harness = createHarness();
    const before = harness.registry.store.getState().location;

    const result = harness.panels.open({
      kind: "panel",
      panel: { kind: "page-slot", page: ticketRef, id: "emoji" },
      resource: { type: "emoji", id: "wave" },
      open: "pin",
    });

    expect(result).toMatchObject({ ok: true });
    const state = harness.registry.store.getState();
    expect(state.location).toBe(before);
    expect(state.placements.map((candidate) => candidate.value)).toContain("ticket:emoji:wave");
    expect(state.reconciliation.activate[0]?.identity).toEqual({
      kind: "page",
      pageId: "ticket",
      slotId: "emoji",
      instanceKey: "pstdio://emoji/wave",
    });
  });

  test("rejects a panel whose mode or page owner is inactive without a partial commit", () => {
    const harness = createHarness();
    const before = harness.registry.store.getState();

    const modeResult = harness.panels.open(sessionTarget(sessionsInspectorRef));
    const pageResult = harness.panels.open({
      kind: "panel",
      panel: { kind: "page-slot", page: sessionsRef, id: "missing" },
    });

    expect(modeResult).toMatchObject({ ok: false, diagnostic: { code: "panel-target-unresolved" } });
    expect(pageResult).toMatchObject({ ok: false, diagnostic: { code: "panel-target-unresolved" } });
    expect(harness.diagnostics).toHaveLength(2);
    expect(harness.registry.store.getState()).toBe(before);
  });

  test("rejects a panel batch without committing panels resolved before the failure", () => {
    const harness = createHarness();
    const before = harness.registry.store.getState();
    let stateChanges = 0;
    const unsubscribe = harness.registry.store.subscribe(() => {
      stateChanges += 1;
    });

    const result = harness.panels.openMany([
      { kind: "panel", panel: { kind: "page-slot", page: ticketRef, id: "notes" } },
      { kind: "panel", panel: { kind: "page-slot", page: ticketRef, id: "missing" } },
    ]);

    unsubscribe();
    expect(result).toMatchObject({ ok: false, diagnostic: { code: "panel-target-unresolved" } });
    expect(harness.diagnostics).toEqual(["Unknown page slot: ticket.missing"]);
    expect(stateChanges).toBe(0);
    expect(harness.registry.store.getState()).toBe(before);
  });

  test("treats an empty panel batch as a no-op", () => {
    const harness = createHarness();
    const before = harness.registry.store.getState();
    let stateChanges = 0;
    const unsubscribe = harness.registry.store.subscribe(() => {
      stateChanges += 1;
    });

    const result = harness.panels.openMany([]);

    unsubscribe();
    expect(result).toEqual({ ok: true, identities: [] });
    expect(stateChanges).toBe(0);
    expect(harness.registry.store.getState()).toBe(before);
  });

  test("rejects invalid mode resolver output before committing it", () => {
    const harness = createHarness((input) => ({
      identity: {
        kind: "mode",
        modeId: input.modeId,
        placementId: "project-session",
        instanceKey: "missing",
      },
      placements: input.current,
    }));
    const before = harness.registry.store.getState();

    const result = harness.panels.open(sessionTarget());

    expect(result).toMatchObject({ ok: false, diagnostic: { code: "panel-target-unresolved" } });
    expect(harness.diagnostics).toHaveLength(1);
    expect(harness.registry.store.getState()).toBe(before);
  });

  test("rejects invalid page panel input without changing layout state", () => {
    const harness = createHarness();
    const before = harness.registry.store.getState();
    const panel = (id: string): NavigationTargetPanel["panel"] => ({ kind: "page-slot", page: ticketRef, id });

    const staticResult = harness.panels.open({ kind: "panel", panel: panel("notes"), open: "pin" });
    const oneResult = harness.panels.open({
      kind: "panel",
      panel: panel("inspector"),
      resource: { type: "emoji", id: "wave" },
      open: "pin",
    });
    const resourceResult = harness.panels.open({
      kind: "panel",
      panel: panel("emoji"),
      resource: { type: "ticket", id: "PS-326" },
    });

    expect([staticResult, oneResult, resourceResult].every((result) => !result.ok)).toBe(true);
    expect(harness.diagnostics).toHaveLength(3);
    expect(harness.registry.store.getState()).toBe(before);
  });
});
