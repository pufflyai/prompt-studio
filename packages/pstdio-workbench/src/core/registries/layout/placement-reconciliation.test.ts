import { describe, expect, test } from "bun:test";
import type { PlacementIdentity } from "@pstdio/sdk/extensions";
import {
  composeOwnedPlacements,
  placementIdentityKey,
  type ResolvedOwnedPlacement,
  reconcileOwnedPlacements,
} from "./placement-reconciliation";

interface TestPlacementValue {
  view: string;
  revision?: number;
}

const modeIdentity = (placementId: string, instanceKey = "default"): PlacementIdentity => ({
  kind: "mode",
  modeId: "pstdio.host.mode.project",
  placementId,
  instanceKey,
});

const pageIdentity = (pageId: string, slotId: string, instanceKey = "default"): PlacementIdentity => ({
  kind: "page",
  pageId,
  slotId,
  instanceKey,
});

const placement = (
  identity: PlacementIdentity,
  region: ResolvedOwnedPlacement<TestPlacementValue>["region"],
  view: string,
  order = 0,
  revision?: number,
): ResolvedOwnedPlacement<TestPlacementValue> => ({
  identity,
  region,
  order,
  value: { view, revision },
});

const keys = (placements: readonly ResolvedOwnedPlacement<TestPlacementValue>[]) =>
  placements.map((candidate) => placementIdentityKey(candidate.identity));

const sameValue = (left: TestPlacementValue, right: TestPlacementValue) => left === right;

describe("owned placement composition", () => {
  test("keeps mode and page placements that use the same region and view", () => {
    const mode = placement(modeIdentity("sessions"), "side", "shared.sessions", 20);
    const page = placement(pageIdentity("pstdio.planner.page.ticket", "emoji"), "side", "shared.sessions", 10);

    const result = composeOwnedPlacements({ shell: [], mode: [mode], page: [page] });

    expect(result.regions.side).toEqual([page, mode]);
    expect(result.placements).toHaveLength(2);
    expect(new Set(keys(result.placements)).size).toBe(2);
  });

  test("sorts equal orders by owner identity and instance key regardless of input order", () => {
    const mode = placement(modeIdentity("sessions"), "side", "mode");
    const pageB = placement(pageIdentity("pstdio.planner.page.ticket", "emoji", "b"), "side", "page-b");
    const pageA = placement(pageIdentity("pstdio.planner.page.ticket", "emoji", "a"), "side", "page-a");

    const direct = composeOwnedPlacements({ shell: [], mode: [mode], page: [pageB, pageA] });
    const restored = composeOwnedPlacements({ shell: [], mode: [mode], page: [pageA, pageB] });

    expect(keys(direct.regions.side)).toEqual(keys(restored.regions.side));
    expect(direct.regions.side.map((candidate) => candidate.value.view)).toEqual(["mode", "page-a", "page-b"]);
  });

  test("filters closed identities without treating a region as closed", () => {
    const mode = placement(modeIdentity("sessions"), "side", "mode");
    const pageA = placement(pageIdentity("pstdio.planner.page.ticket", "emoji"), "side", "page-a");
    const pageB = placement(pageIdentity("pstdio.planner.page.ticket", "notes"), "side", "page-b");

    const result = composeOwnedPlacements({
      shell: [],
      mode: [mode],
      page: [pageA, pageB],
      closed: [pageA.identity, pageB.identity],
    });

    expect(result.regions.side).toEqual([mode]);
    expect(result.visibleRegions.has("side")).toBe(true);
    expect(result.closed.map((candidate) => candidate.value.view)).toEqual(["page-a", "page-b"]);
  });

  test("closes one page placement without closing its siblings or mode placements", () => {
    const mode = placement(modeIdentity("sessions"), "side", "mode");
    const pageA = placement(pageIdentity("pstdio.planner.page.ticket", "emoji"), "side", "page-a");
    const pageB = placement(pageIdentity("pstdio.planner.page.ticket", "notes"), "side", "page-b");

    const result = composeOwnedPlacements({ shell: [], mode: [mode], page: [pageA, pageB], closed: [pageA.identity] });

    expect(result.regions.side).toEqual([mode, pageB]);
    expect(result.closed).toEqual([pageA]);
  });

  test("rejects a placement whose identity does not match its declared owner", () => {
    const foreign = placement(pageIdentity("pstdio.planner.page.ticket", "emoji"), "side", "foreign");

    expect(() => composeOwnedPlacements({ shell: [], mode: [foreign], page: [] })).toThrow(
      "Mode placement must have a mode owner",
    );
  });

  test("rejects duplicate full identities instead of silently selecting one", () => {
    const identity = modeIdentity("sessions");
    const first = placement(identity, "side", "first");
    const second = placement(identity, "secondary", "second");

    expect(() => composeOwnedPlacements({ shell: [], mode: [first, second], page: [] })).toThrow(
      `Duplicate placement identity: ${placementIdentityKey(identity)}`,
    );
  });

  test("rejects placements from more than one active mode or page", () => {
    const projectMode = placement(modeIdentity("sessions"), "side", "project");
    const sessionsMode = placement(
      { kind: "mode", modeId: "pstdio.host.mode.sessions", placementId: "header", instanceKey: "default" },
      "sidenav-header",
      "sessions",
    );
    const ticketPage = placement(pageIdentity("pstdio.planner.page.ticket", "primary"), "main", "ticket");
    const ticketsPage = placement(pageIdentity("pstdio.planner.page.tickets", "primary"), "main", "tickets");

    expect(() => composeOwnedPlacements({ shell: [], mode: [projectMode, sessionsMode], page: [] })).toThrow(
      "Mode placements must belong to one active mode",
    );
    expect(() => composeOwnedPlacements({ shell: [], mode: [], page: [ticketPage, ticketsPage] })).toThrow(
      "Page placements must belong to one active page",
    );
  });

  test("rejects non-finite order values", () => {
    const unordered = placement(modeIdentity("sessions"), "side", "mode", Number.NaN);

    expect(() => composeOwnedPlacements({ shell: [], mode: [unordered], page: [] })).toThrow(
      "Placement order must be a finite number",
    );
  });
});

describe("owned placement reconciliation", () => {
  test("removes one owner without removing another owner of the same view", () => {
    const mode = placement(modeIdentity("sessions"), "side", "shared.sessions");
    const page = placement(pageIdentity("pstdio.planner.page.ticket", "emoji"), "side", "shared.sessions");

    const plan = reconcileOwnedPlacements({ current: [mode, page], desired: [mode], valuesEqual: sameValue });

    expect(plan.retain).toEqual([mode]);
    expect(plan.remove).toEqual([page]);
  });

  test("retains mode state while replacing only the outgoing page placements", () => {
    const mode = placement(modeIdentity("sessions"), "side", "mode");
    const outgoing = placement(pageIdentity("pstdio.planner.page.ticket", "emoji"), "side", "outgoing");
    const incoming = placement(pageIdentity("pstdio.planner.page.tickets", "filters"), "side", "incoming");
    const current = composeOwnedPlacements({ shell: [], mode: [mode], page: [outgoing] });
    const desired = composeOwnedPlacements({ shell: [], mode: [mode], page: [incoming] });

    const plan = reconcileOwnedPlacements({
      current: current.placements,
      desired: desired.placements,
      valuesEqual: sameValue,
    });

    expect(keys(plan.retain)).toEqual([placementIdentityKey(mode.identity)]);
    expect(keys(plan.remove)).toEqual([placementIdentityKey(outgoing.identity)]);
    expect(keys(plan.add)).toEqual([placementIdentityKey(incoming.identity)]);
  });

  test("removes the outgoing page and mode when both owners change", () => {
    const projectMode = placement(modeIdentity("sessions"), "side", "project-mode");
    const ticketPage = placement(pageIdentity("pstdio.planner.page.ticket", "editor"), "main", "ticket-page");
    const sessionsMode = placement(
      { kind: "mode", modeId: "pstdio.host.mode.sessions", placementId: "project", instanceKey: "default" },
      "sidenav-header",
      "sessions-mode",
    );
    const sessionsPage = placement(pageIdentity("pstdio.host.page.sessions", "primary"), "main", "sessions-page");

    const plan = reconcileOwnedPlacements({
      current: composeOwnedPlacements({ shell: [], mode: [projectMode], page: [ticketPage] }).placements,
      desired: composeOwnedPlacements({ shell: [], mode: [sessionsMode], page: [sessionsPage] }).placements,
      valuesEqual: sameValue,
    });

    expect(keys(plan.remove)).toEqual(keys([projectMode, ticketPage]));
    expect(keys(plan.add)).toEqual(keys([sessionsMode, sessionsPage]));
    expect(plan.retain).toEqual([]);
  });

  test("distinguishes retained and updated placements by caller-owned value equality", () => {
    const identity = pageIdentity("pstdio.planner.page.ticket", "editor", "ticket:PS-326");
    const current = placement(identity, "main", "editor", 0, 1);
    const desired = placement(identity, "main", "editor", 0, 2);

    const plan = reconcileOwnedPlacements({
      current: [current],
      desired: [desired],
      valuesEqual: (left, right) => left.revision === right.revision,
    });

    expect(plan.retain).toEqual([]);
    expect(plan.update).toEqual([{ current, desired }]);
  });

  test("does not activate a newly added auxiliary placement without explicit intent", () => {
    const mode = placement(modeIdentity("sessions"), "side", "mode");
    const auxiliary = placement(pageIdentity("pstdio.planner.page.ticket", "emoji"), "side", "page");
    const primary = placement(pageIdentity("pstdio.planner.page.ticket", "primary"), "main", "primary");

    const passive = reconcileOwnedPlacements({
      current: [mode],
      desired: [mode, auxiliary, primary],
      valuesEqual: sameValue,
    });
    const primaryActivation = reconcileOwnedPlacements({
      current: [mode],
      desired: [mode, auxiliary, primary],
      activate: [primary.identity],
      valuesEqual: sameValue,
    });

    expect(passive.activate).toEqual([]);
    expect(keys(primaryActivation.activate)).toEqual([placementIdentityKey(primary.identity)]);
  });

  test("rejects activation of a placement outside the desired set", () => {
    const missing = pageIdentity("pstdio.planner.page.ticket", "emoji");

    expect(() =>
      reconcileOwnedPlacements({ current: [], desired: [], activate: [missing], valuesEqual: sameValue }),
    ).toThrow(`Cannot activate missing placement: ${placementIdentityKey(missing)}`);
  });
});
