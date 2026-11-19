import { expect, test } from "bun:test";
import type { PageRef } from "@pstdio/sdk/extensions";
import { createMemoryWorkbenchPageLocationPersistence } from "./controllers/page-location/page-location-memory";
import { createWorkbench } from "./workbench-core";

const desk = { kind: "page" as const, extensionId: "example.space", id: "desk" };
const inbox = { kind: "page" as const, extensionId: "example.mail", id: "inbox" };
const register = (w: ReturnType<typeof createWorkbench>, ref: PageRef, resource = false) =>
  w.pages.registerPage({
    id: `${ref.extensionId}.page.${ref.id}`,
    ref,
    path: `arbitrary-${ref.id}`,
    modeId: "project",
    ...(resource ? { resource: { kinds: [{ kind: "resource-kind" as const, id: "document" }] } } : {}),
    main: { kind: "panels" },
    slots: [],
  });

test("the configured default can be any ordinary resource-free page and changes between projects", () => {
  let selected: PageRef | undefined = inbox;
  const w = createWorkbench({ defaultPage: () => selected });
  w.modes.registerMode({ id: "project", activate() {} });
  register(w, desk);
  register(w, inbox);
  expect(w.pageLocations.boot("one").ok).toBe(true);
  expect(w.pages.store.getState().location?.page).toEqual(inbox);
  selected = desk;
  expect(w.pageLocations.switchProject("two").ok).toBe(true);
  expect(w.pages.store.getState().location?.page).toEqual(desk);
  w.dispose();
});

test("a valid restored destination takes precedence over a changed project default", () => {
  const persistence = createMemoryWorkbenchPageLocationPersistence();
  const first = createWorkbench({ defaultPage: desk, pageLocationPersistence: persistence });
  first.modes.registerMode({ id: "project", activate() {} });
  register(first, desk);
  register(first, inbox);
  expect(first.pageLocations.boot("one").ok).toBe(true);
  expect(first.pageLocations.navigate({ kind: "page", page: inbox }).ok).toBe(true);
  first.dispose();

  let entry = { url: "/projects/one" };
  const restored = createWorkbench({
    defaultPage: desk,
    pageLocationPersistence: persistence,
    pageLocationBrowser: {
      current: () => entry,
      push: (next) => {
        entry = next;
      },
      replace: (next) => {
        entry = next;
      },
      back() {},
      forward() {},
      onPopState: () => ({ dispose() {} }),
    },
  });
  restored.modes.registerMode({ id: "project", activate() {} });
  register(restored, desk);
  register(restored, inbox);
  expect(restored.pageLocations.boot("one").ok).toBe(true);
  expect(restored.pages.store.getState().location?.page).toEqual(inbox);
  restored.dispose();

  const unavailableSaved = createWorkbench({ defaultPage: desk, pageLocationPersistence: persistence });
  unavailableSaved.modes.registerMode({ id: "project", activate() {} });
  register(unavailableSaved, desk);
  expect(unavailableSaved.pageLocations.boot("one").ok).toBe(true);
  expect(unavailableSaved.pages.store.getState().location?.page).toEqual(desk);
  unavailableSaved.dispose();
});

test("an explicit ordinary page URL takes precedence over the project default", () => {
  let entry = { url: "/projects/one/extensions/example.space/arbitrary-desk" };
  const w = createWorkbench({
    defaultPage: inbox,
    pageLocationBrowser: {
      current: () => entry,
      push: (next) => {
        entry = next;
      },
      replace: (next) => {
        entry = next;
      },
      back() {},
      forward() {},
      onPopState: () => ({ dispose() {} }),
    },
  });
  w.modes.registerMode({ id: "project", activate() {} });
  register(w, desk);
  register(w, inbox);
  expect(w.pageLocations.boot("one").ok).toBe(true);
  expect(w.pages.store.getState().location?.page).toEqual(desk);
  w.dispose();
});

test("an unavailable or resource-bound default leaves an empty workbench and unrelated controls usable", async () => {
  for (const configured of [undefined, { ...desk, id: "unavailable" }, desk]) {
    const w = createWorkbench({ defaultPage: configured });
    w.modes.registerMode({ id: "project", activate() {} });
    register(w, inbox);
    if (configured === desk) register(w, desk, true);
    w.commands.registerCommand({ id: "example.manage", label: "Manage tools" }, { execute: () => "available" });
    w.pageLocations.boot("one");
    expect(w.pages.store.getState().location).toBeUndefined();
    expect(w.commands.getCommand("example.manage")).toBeDefined();
    expect(await w.commands.executeCommand("example.manage")).toBe("available");
    expect(w.pageLocations.navigate({ kind: "page", page: inbox }).ok).toBe(true);
    expect(w.pages.store.getState().location?.page).toEqual(inbox);
    w.dispose();
  }
});

test("the public default-page command follows project composition and clears an unavailable selection", async () => {
  let selected: PageRef | undefined = desk;
  const w = createWorkbench({ defaultPage: () => selected });
  w.modes.registerMode({ id: "project", activate() {} });
  register(w, desk);
  register(w, inbox);
  w.pageLocations.boot("one");
  w.pageLocations.navigate({ kind: "page", page: inbox });
  await w.commands.executeCommand("workbench.page.openDefault");
  expect(w.pages.store.getState().location?.page).toEqual(desk);
  selected = undefined;
  await w.commands.executeCommand("workbench.page.openDefault");
  expect(w.pages.store.getState().location).toBeUndefined();
  w.dispose();
});
