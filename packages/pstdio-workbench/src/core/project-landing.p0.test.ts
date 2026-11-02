import { expect, test } from "bun:test";
import type { PageRef } from "@pstdio/sdk/extensions";
import { createMemoryWorkbenchPageLocationBrowser } from "./controllers/page-location/page-location-memory";
import { createWorkbench } from "./workbench-core";

const home: PageRef = { extensionId: "acme.home", kind: "page", id: "home" };
const tools: PageRef = { extensionId: "acme.tools", kind: "page", id: "tools" };
const setup = () => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  browser.replace({ url: "/projects/project-1" });
  const core = createWorkbench({ pageLocationBrowser: browser });
  core.modes.registerMode({ id: "project", activate: () => undefined });
  const register = (ref: PageRef, projectLanding?: true) =>
    core.pages.registerPage({
      id: `${ref.extensionId}.${ref.id}`,
      ref,
      path: ref.id,
      modeId: "project",
      projectLanding,
      main: { kind: "panels" },
      slots: [],
    });
  register(tools);
  return { core, register, browser };
};

test("opens an extension landing page from a project root bookmark and breadcrumb", () => {
  const { core, register } = setup();
  register(home, true);
  expect(core.pageLocations.getBootLocation("project-1")?.page).toEqual(home);
  expect(core.pageLocations.boot("project-1")).toMatchObject({ ok: true, location: { page: home } });
  core.pageLocations.navigate({ kind: "page", page: tools });
  expect(core.pageLocations.navigateToRootLevel()).toMatchObject({ ok: true, location: { page: tools } });
});

test("removing and restoring the landing provider keeps other pages usable", () => {
  const { core, register } = setup();
  const registration = register(home, true);
  core.pageLocations.boot("project-1");
  registration.dispose();
  expect(core.pages.store.getState().location?.page).toEqual(tools);
  expect(core.pageLocations.boot("project-1")).toMatchObject({ ok: true, location: { page: tools } });
  register(home, true);
  expect(core.pages.listPages().filter((page) => page.projectLanding)).toHaveLength(1);
  expect(core.pageLocations.navigate({ kind: "page", page: home }).ok).toBe(true);
});

test("restores saved destinations per project without replacing them with Home", () => {
  const { core, register } = setup();
  register(home, true);
  core.pageLocations.boot("project-1");
  core.pageLocations.navigate({ kind: "page", page: tools });
  core.pageLocations.switchProject("project-2");
  expect(core.pages.store.getState().location?.page).toEqual(home);
  core.pageLocations.switchProject("project-1");
  expect(core.pages.store.getState().location?.page).toEqual(tools);
});

test("old public Start targets resolve to the currently installed landing provider", () => {
  const { core, register } = setup();
  register(home, true);
  core.pageLocations.setProject("project-1");
  expect(
    core.pageLocations.navigate({ kind: "page", page: { extensionId: "pstdio", kind: "page", id: "start" } }),
  ).toMatchObject({ ok: true, location: { page: home } });
});

test("old Start parents resolve through navigation and replay after host extraction", () => {
  const { core, register } = setup();
  register(home, true);
  core.pageLocations.setProject("project-1");
  const parent = { page: { kind: "page" as const, extensionId: "pstdio", id: "start" } };
  expect(core.pageLocations.navigate({ kind: "page", page: tools, parent: { kind: "page", ...parent } })).toMatchObject(
    { ok: true, location: { page: tools, parent: { page: home } } },
  );
  expect(core.pageLocations.replay({ page: tools, parent })).toMatchObject({
    ok: true,
    location: { page: tools, parent: { page: home } },
  });
});
