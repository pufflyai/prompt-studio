import { beforeEach, describe, expect, test } from "bun:test";
import {
  createPageLocationHarness,
  labRef,
  notesRef,
  sessionsRef,
  startRef,
  ticketRef,
  ticketsRef,
  workspaceRef,
} from "./page-location-controller.test-support";

// Sessions, Notes and tickets own a content navigation tree, so each one opens a Sidenav level.
const createLevelHarness = (url?: string) => {
  const harness = createPageLocationHarness(url);
  for (const pageId of ["sessions", "notes", "ticket"]) harness.openLevel(pageId);
  return harness;
};

const reload = (harness: ReturnType<typeof createLevelHarness>, url: string) => {
  const next = createLevelHarness(url);
  for (const [projectId, persisted] of harness.persistence.values) next.persistence.values.set(projectId, persisted);
  return next;
};

const page = (ref: { id: string }) => ref.id;

describe("last root-level location", () => {
  let harness: ReturnType<typeof createLevelHarness>;

  beforeEach(() => {
    harness = createLevelHarness();
    harness.controller.boot("p1");
  });

  test("returns to the board after a level page and a page inside it", () => {
    harness.controller.navigate({ kind: "page", page: ticketsRef });
    harness.controller.navigate({ kind: "page", page: sessionsRef });
    harness.controller.navigate({
      kind: "page",
      page: { extensionId: "pstdio", kind: "page", id: "session" },
      resource: { type: "session", id: "s-1" },
    });
    harness.controller.navigateToRootLevel();
    expect(page(harness.registry.store.getState().location!.page)).toBe(page(ticketsRef));
  });

  test("remembers the root-level parent of a level page opened from the board", () => {
    harness.controller.navigate({ kind: "page", page: ticketsRef });
    harness.controller.navigate({ kind: "page", page: ticketRef, resource: { type: "ticket", id: "PS-1" } });
    harness.controller.navigate({ kind: "page", page: sessionsRef });
    harness.controller.navigateToRootLevel();
    expect(page(harness.registry.store.getState().location!.page)).toBe(page(ticketsRef));
  });

  test("skips every nested level, including a page opened inside itself", () => {
    harness.controller.navigate({ kind: "page", page: ticketsRef });
    harness.controller.navigate({ kind: "page", page: ticketRef, resource: { type: "ticket", id: "PS-1" } });
    harness.controller.navigate({
      kind: "page",
      page: ticketRef,
      resource: { type: "ticket", id: "PS-2" },
      parent: { kind: "page", page: ticketRef, resource: { type: "ticket", id: "PS-1" } },
    });
    harness.controller.navigate({ kind: "page", page: sessionsRef });
    harness.controller.navigateToRootLevel();
    const location = harness.registry.store.getState().location!;
    expect(page(location.page)).toBe(page(ticketsRef));
    expect(location.resource).toBeUndefined();
  });

  test("treats a page whose mode replaces the Sidenav as a level", () => {
    harness.controller.navigate({ kind: "page", page: ticketsRef });
    harness.controller.navigate({ kind: "page", page: labRef });
    harness.controller.navigateToRootLevel();
    expect(page(harness.registry.store.getState().location!.page)).toBe(page(ticketsRef));
  });

  test("keeps the saved page when the user moves between levels", () => {
    harness.controller.navigate({ kind: "page", page: ticketsRef });
    harness.controller.navigate({ kind: "page", page: sessionsRef });
    harness.controller.navigate({ kind: "page", page: notesRef });
    harness.controller.navigateToRootLevel();
    expect(page(harness.registry.store.getState().location!.page)).toBe(page(ticketsRef));
  });

  test("falls back to the start page when the saved page showed a removed resource", () => {
    harness.controller.navigate({ kind: "page", page: workspaceRef, resource: { type: "workspace", id: "WS-4" } });
    harness.controller.navigate({ kind: "page", page: sessionsRef });
    harness.controller.removeResource({ type: "workspace", id: "WS-4" }, []);
    harness.controller.navigateToRootLevel();
    expect(page(harness.registry.store.getState().location!.page)).toBe(page(startRef));
  });

  test("falls back to the start page when no root-level page has been used", () => {
    const booted = createLevelHarness("/projects/p1/sessions");
    booted.controller.boot("p1");
    expect(page(booted.registry.store.getState().location!.page)).toBe(page(sessionsRef));
    booted.controller.navigateToRootLevel();
    expect(page(booted.registry.store.getState().location!.page)).toBe(page(startRef));
  });

  test("survives a reload that opens a level page straight from the URL", () => {
    harness.controller.navigate({ kind: "page", page: ticketsRef });
    harness.controller.navigate({ kind: "page", page: sessionsRef });
    const reloaded = reload(harness, "/projects/p1/sessions");
    reloaded.controller.boot("p1");
    expect(page(reloaded.registry.store.getState().location!.page)).toBe(page(sessionsRef));
    reloaded.controller.navigateToRootLevel();
    expect(page(reloaded.registry.store.getState().location!.page)).toBe(page(ticketsRef));
  });

  test("stays put on a root-level page", () => {
    harness.controller.navigate({ kind: "page", page: ticketsRef });
    const pushes = harness.browser.pushes.length;
    harness.controller.navigateToRootLevel();
    expect(page(harness.registry.store.getState().location!.page)).toBe(page(ticketsRef));
    expect(harness.browser.pushes).toHaveLength(pushes);
  });

  test("forgets the root-level page of the project the user left", () => {
    harness.controller.navigate({ kind: "page", page: ticketsRef });
    harness.controller.switchProject("p2");
    harness.controller.navigate({ kind: "page", page: sessionsRef });
    harness.controller.navigateToRootLevel();
    expect(page(harness.registry.store.getState().location!.page)).toBe(page(startRef));
  });

  // Hosts can select a project and navigate straight into one of its level pages, without booting it.
  test("forgets the root-level page when a host selects a project and opens a level page", () => {
    harness.controller.navigate({ kind: "page", page: ticketsRef });
    harness.controller.setProject("p2");
    harness.controller.navigate({ kind: "page", page: sessionsRef });
    harness.controller.navigateToRootLevel();
    expect(page(harness.registry.store.getState().location!.page)).toBe(page(startRef));
  });
});
