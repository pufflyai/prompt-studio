import { describe, expect, test } from "bun:test";
import {
  createPageLocationHarness as createHarness,
  pageRef as ref,
  startRef,
  ticketRef,
  ticketsRef,
  ticketTarget,
  workspaceRef,
} from "./page-location-controller.test-support";

describe("page location controller", () => {
  test("commits canonical location, mode, page, and placements in one observable transition", () => {
    const harness = createHarness();
    harness.controller.boot("p1");
    const observed: Array<{ pageId?: string; resourceId?: string; owners: string[] }> = [];
    const unsubscribe = harness.registry.store.subscribe((state) => {
      observed.push({
        pageId: state.activePageId,
        resourceId: state.location?.resource?.id,
        owners: state.placements.map((candidate) => candidate.identity.kind),
      });
    });

    const result = harness.controller.navigate(ticketTarget());
    unsubscribe();

    expect(result.ok).toBe(true);
    expect(observed).toEqual([{ pageId: "ticket", resourceId: "PS-326", owners: ["shell", "page", "mode"] }]);
    expect(harness.browser.pushes).toHaveLength(1);
    expect(harness.browser.current().url).toBe(
      "/projects/p1/extensions/acme.planner/ticket?resource=pstdio%3A%2F%2Fticket%2FPS-326",
    );
    expect(harness.persistence.values.get("p1")?.resource?.id).toBe("PS-326");
  });

  test("lets a direct URL beat saved state and uses declared parents instead of stale context", () => {
    const harness = createHarness("/projects/p1/workspaces?resource=pstdio%3A%2F%2Fworkspace%2FWS-4");
    harness.persistence.values.set("p1", {
      page: ticketRef,
      resource: { type: "ticket", id: "PS-1" },
      parent: { page: ticketsRef },
    });

    harness.controller.boot("p1");

    expect(harness.registry.store.getState().location).toEqual({
      page: workspaceRef,
      resource: { type: "workspace", id: "WS-4" },
      parent: { page: startRef },
    });
    expect(harness.browser.pushes).toEqual([]);
    expect(harness.browser.replacements).toHaveLength(1);
  });

  test("restores saved state only without a URL target and otherwise opens fixed Start", () => {
    const saved = createHarness("/unrelated");
    saved.persistence.values.set("p1", { page: ticketsRef, parent: { page: startRef } });
    saved.controller.boot("p1");
    expect(saved.registry.store.getState().activePageId).toBe("tickets");

    const fresh = createHarness("/unrelated");
    fresh.controller.boot("p1");
    expect(fresh.registry.store.getState().location).toEqual({ page: startRef });
  });

  test("does not attach saved state when a project URL is unresolved", () => {
    const harness = createHarness("/projects/p1/extensions/missing.extension/not-installed");
    harness.persistence.values.set("p1", { page: ticketsRef, parent: { page: startRef } });

    harness.controller.boot("p1");

    expect(harness.registry.store.getState().location).toEqual({ page: startRef });
    expect(harness.diagnostics[0]).toMatch(/cannot resolve page url/i);
  });

  test("replays matching history context without writing another history entry", () => {
    const harness = createHarness();
    harness.controller.boot("p1");
    harness.controller.navigate(ticketTarget());
    harness.controller.navigate({
      kind: "page",
      page: workspaceRef,
      resource: { type: "workspace", id: "ws-4" },
      parent: ticketTarget(),
    });
    const workspaceEntry = harness.browser.current();
    harness.controller.navigate({ kind: "page", page: ticketsRef });
    const writesBeforePop = harness.browser.pushes.length + harness.browser.replacements.length;

    harness.browser.pop(workspaceEntry);

    expect(harness.registry.store.getState().location).toEqual({
      page: workspaceRef,
      resource: { type: "workspace", id: "WS-4" },
      parent: {
        page: ticketRef,
        resource: { type: "ticket", id: "PS-326" },
        parent: { page: ticketsRef, parent: { page: startRef } },
      },
    });
    expect(harness.browser.pushes.length + harness.browser.replacements.length).toBe(writesBeforePop);
  });

  test("clears the old project composition before resolving the new project", () => {
    const harness = createHarness();
    harness.controller.boot("p1");
    harness.controller.navigate({ ...ticketTarget("PS-1"), open: "pin" });
    harness.persistence.values.set("p2", {
      page: ticketRef,
      resource: { type: "ticket", id: "PS-2" },
      parent: { page: ticketsRef, parent: { page: startRef } },
    });
    const observed: Array<{ projectId?: string; pageId?: string; pageOwners: string[] }> = [];
    const unsubscribe = harness.registry.store.subscribe((state) => {
      observed.push({
        projectId: state.projectId,
        pageId: state.activePageId,
        pageOwners: state.placements.flatMap((candidate) =>
          candidate.identity.kind === "page" ? [candidate.identity.pageId] : [],
        ),
      });
    });

    harness.controller.switchProject("p2");
    unsubscribe();

    expect(observed).toEqual([
      { projectId: "p2", pageId: undefined, pageOwners: [] },
      { projectId: "p2", pageId: "ticket", pageOwners: ["ticket"] },
    ]);
    expect(
      harness.registry.store
        .getState()
        .placements.flatMap((candidate) =>
          candidate.identity.kind === "page" ? [candidate.identity.instanceKey] : [],
        ),
    ).toEqual(["pstdio://ticket/PS-2"]);
  });

  test("leaves location and history unchanged when a target cannot resolve", () => {
    const harness = createHarness();
    harness.controller.boot("p1");
    const before = harness.registry.store.getState();
    const writes = harness.browser.pushes.length + harness.browser.replacements.length;

    const result = harness.controller.navigate({ kind: "page", page: ref("missing", "page") });

    expect(result.ok).toBe(false);
    expect(harness.registry.store.getState()).toBe(before);
    expect(harness.browser.pushes.length + harness.browser.replacements.length).toBe(writes);
    expect(harness.diagnostics[0]).toMatch(/missing.*page/i);
  });

  test("replaces history when closing the active bound-only primary to its parent", () => {
    const harness = createHarness();
    harness.controller.boot("p1");
    harness.controller.navigate(ticketTarget());
    const pushes = harness.browser.pushes.length;

    harness.controller.closePlacement({
      kind: "page",
      pageId: "ticket",
      slotId: "content",
      instanceKey: "pstdio://ticket/PS-326",
    });

    expect(harness.registry.store.getState().location).toEqual({ page: ticketsRef, parent: { page: startRef } });
    expect(harness.browser.pushes).toHaveLength(pushes);
    expect(harness.browser.replacements.at(-1)?.url).toBe("/projects/p1/extensions/acme.planner/tickets");
  });

  test("does not write history when closing an inactive pinned primary", () => {
    const harness = createHarness();
    harness.controller.boot("p1");
    harness.controller.navigate({ ...ticketTarget("PS-1"), open: "pin" });
    harness.controller.navigate({ ...ticketTarget("PS-2"), open: "pin" });
    const writes = harness.browser.pushes.length + harness.browser.replacements.length;

    harness.controller.closePlacement({
      kind: "page",
      pageId: "ticket",
      slotId: "content",
      instanceKey: "pstdio://ticket/PS-1",
    });

    expect(harness.registry.store.getState().location?.resource?.id).toBe("PS-2");
    expect(harness.browser.pushes.length + harness.browser.replacements.length).toBe(writes);
  });

  test("removes an active unregistered page by owner and replaces it with Start once", () => {
    const harness = createHarness();
    const disposable = harness.registry.registerPage({
      id: "temporary",
      ref: ref("acme.temp", "temporary"),
      title: "Temporary",
      path: "temporary",
      modeId: "project",
      slots: [{ id: "content", role: "primary", region: "main", viewId: "temporary" }],
    });
    harness.controller.boot("p1");
    harness.controller.navigate({ kind: "page", page: ref("acme.temp", "temporary") });
    const replacements = harness.browser.replacements.length;

    disposable.dispose();

    expect(harness.registry.store.getState().location).toEqual({ page: startRef });
    expect(
      harness.registry.store.getState().placements.some((candidate) => candidate.value.includes("temporary")),
    ).toBe(false);
    expect(harness.browser.replacements).toHaveLength(replacements + 1);
  });

  test("rebuilds declared hierarchy when a contextual parent unregisters", () => {
    const harness = createHarness();
    const parent = harness.registry.registerPage({
      id: "temporary-parent",
      ref: ref("acme.temp", "parent"),
      title: "Temporary parent",
      path: "parent",
      modeId: "project",
      slots: [{ id: "content", role: "primary", region: "main", viewId: "parent" }],
    });
    harness.controller.boot("p1");
    harness.controller.navigate({
      kind: "page",
      page: workspaceRef,
      resource: { type: "workspace", id: "WS-4" },
      parent: { kind: "page", page: ref("acme.temp", "parent") },
    });

    parent.dispose();

    expect(harness.registry.store.getState().location).toEqual({
      page: workspaceRef,
      resource: { type: "workspace", id: "WS-4" },
      parent: { page: startRef },
    });
  });
});
