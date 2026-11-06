import { expect, test } from "bun:test";
import { sessionBrowser, workbenchCommands, workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench, type PreferenceValue } from "@pstdio/workbench";
import { createWorkbenchWebviewHostAdapters } from "@pstdio/workbench/extensions";
import { getWriter } from "@/lib/sync/collections";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createSessionsModule } from "../sessions/module";
import { registerSessionProvider } from "../sessions/session-provider.fixture";
import { createRecentResourcesModule } from "./module";

const setup = () => {
  const saved = new Map<string, PreferenceValue>();
  const workbench = createWorkbench({
    preferencePersistence: {
      getValue: (name, scope) => saved.get(`${name}:${scope.scopeId}`),
      setValue: (name, value, scope) => {
        saved.set(`${name}:${scope.scopeId}`, value);
      },
    },
  });
  workbench.modes.registerMode({ id: "project", activate() {} });
  workbench.registerModule(createSessionsModule());
  registerSessionProvider(workbench);
  workbench.registerModule(createRecentResourcesModule());
  const home = { kind: "page" as const, id: "home", extensionId: "pstdio.pstdio-home" };
  workbench.views.registerView({ id: "home-view", title: "Home", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "home",
    ref: home,
    path: "home",
    modeId: "project",
    main: { kind: "view", view: { kind: "view", id: "home-view" }, cardinality: "one" },
    slots: [],
  });
  selectDashboardProject(workbench, { id: "project-1", name: "Project" });
  workbench.pageLocations.setProject("project-1");
  getWriter("sessions")!.upsert({
    id: "recent-session",
    project_id: "project-1",
    title: "Home conversation",
    status: "completed",
    archived: false,
  });
  return {
    workbench,
    home,
    saved,
    read: () => workbench.commands.executeCommand(workbenchCommands.recentResources.id),
    dispose: async () => {
      getWriter("sessions")!.remove("recent-session");
      await workbench.dispose();
    },
  };
};

test("Home reopens a bare legacy session URL through its actual recent target", async () => {
  const fixture = setup();
  const { workbench, home } = fixture;
  try {
    expect(
      workbench.pageLocations.navigate({
        kind: "page",
        page: workbenchPages.session,
        resource: { type: "session", id: "recent-session" },
      }).ok,
    ).toBe(true);
    await workbench.navigation.openPage({ page: home });
    const [recent] = (await fixture.read()) as NonNullable<typeof workbenchCommands.recentResources.result>;
    expect(recent!.target).toMatchObject({ resource: { extensionId: "pstdio", projectId: "project-1" } });
    const host = createWorkbenchWebviewHostAdapters({
      workbench,
      extensionId: home.extensionId,
      projectId: "project-1",
    });
    await host.navigation!.open(recent!.target);
    expect(workbench.pages.store.getState().location?.page).toEqual(workbenchPages.session);
  } finally {
    await fixture.dispose();
  }
});

test("saved compound recents qualify bare core targets while preserving explicit resource owners", async () => {
  const fixture = setup();
  try {
    const bare = { type: "session", id: "recent-session" };
    const foreign = { ...bare, extensionId: "another.provider", projectId: "another-project" };
    fixture.saved.set("workbench.recentResources:project-1", {
      items: [
        {
          resource: { ...bare, extensionId: "pstdio", projectId: "project-1" },
          target: {
            kind: "compound",
            targets: [
              { kind: "page", page: workbenchPages.session, resource: bare },
              { kind: "panel", panel: sessionBrowser.panels.conversation, resource: bare },
              { kind: "panel", panel: sessionBrowser.panels.conversation, resource: foreign },
            ],
          },
        },
      ],
    });
    const [recent] = (await fixture.read()) as NonNullable<typeof workbenchCommands.recentResources.result>;
    expect(recent!.target).toMatchObject({
      kind: "compound",
      targets: [
        { resource: { ...bare, extensionId: "pstdio", projectId: "project-1" } },
        { resource: { ...bare, extensionId: "pstdio", projectId: "project-1" } },
        { resource: foreign },
      ],
    });
  } finally {
    await fixture.dispose();
  }
});

test("unsupported saved target kinds do not prevent reading a valid recent destination", async () => {
  const fixture = setup();
  try {
    const resource = { type: "session", id: "recent-session", extensionId: "pstdio", projectId: "project-1" };
    fixture.saved.set("workbench.recentResources:project-1", {
      items: [
        { resource, target: { kind: "href", href: "https://example.com" } },
        { resource, target: { kind: "page", page: workbenchPages.session, resource } },
      ],
    });
    expect(await fixture.read()).toMatchObject([{ resource, target: { kind: "page" } }]);
  } finally {
    await fixture.dispose();
  }
});
