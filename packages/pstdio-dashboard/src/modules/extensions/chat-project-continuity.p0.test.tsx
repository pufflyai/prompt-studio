import { expect, test } from "bun:test";
import { createWorkbench, type WorkbenchCore } from "@pstdio/workbench";
import type { ReactElement } from "react";
import { selectDashboardProject } from "@/shared/app/project-context";
import { emptyDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";
import { createExtensionsModule } from "./module";
import { emptyAppearance, flushMicrotasks } from "./module-test-fixtures";

const id = "acme.chat.view.chat";
const metadata = {
  ...emptyDashboardExtensionMetadata,
  extensions: [{ id: "acme.chat", name: "chat", displayName: "Chat", sourcePath: "" }],
  views: [
    {
      id,
      localId: "chat",
      extensionId: "acme.chat",
      title: "Chat",
      body: {
        kind: "chat" as const,
        draftKey: "draft",
        queryHandlerId: "query",
        actionHandlerId: "action",
      },
    },
  ],
};
interface Session {
  retain(): () => void;
  query: { read(): Promise<unknown> };
  changeDraft(update: { text: string }): void;
  getSnapshot(): { draft: { text: string }; loading: boolean };
}
const render = (core: WorkbenchCore, resource: string) => {
  const view = core.views.getView(id)!;
  if (view.body.kind !== "react") throw new Error("Expected the native chat renderer");
  return (
    view.body.render({
      workbench: core,
      instance: { instanceId: resource, panelId: id, closable: true, resource: { type: "session", id: resource } },
      panel: { id, title: "Chat", rendererId: id, region: "main" },
      refresh() {},
    }) as ReactElement<{ session: Session }>
  ).props.session;
};

for (const count of [2, 10])
  test(`${count} dashboard projects retain five warm chats and their drafts without another finite read`, async () => {
    const core = createWorkbench();
    core.modes.registerMode({ id: "project", label: "Project", activate() {} });
    const calls: string[] = [];
    const select = async (index: number) => {
      selectDashboardProject(core, { id: `chat-${count}-${index}`, name: String(index) });
      await flushMicrotasks();
    };
    await select(0);
    const registration = core.registerModule(
      createExtensionsModule({
        loadMetadata: async () => metadata,
        loadAppearance: async () => emptyAppearance,
        executeCommand: async (projectId, commandId) => {
          calls.push(projectId);
          return {
            commandId,
            extensionId: "acme.chat",
            outcome: { ok: true, status: "success", value: { messages: [] } },
          };
        },
      }),
    );
    const owners: Session[][] = [];
    try {
      await flushMicrotasks();
      for (let project = 0; project < count; project++) {
        await select(project);
        const sessions = Array.from({ length: 5 }, (_, resource) => render(core, String(resource)));
        const releases = sessions.map((session) => session.retain());
        await Promise.all(sessions.map((session) => session.query.read()));
        sessions.forEach((session, resource) => {
          session.changeDraft({ text: `${project}/${resource}` });
        });
        for (const release of releases) release();
        owners.push(sessions);
      }
      expect(calls).toHaveLength(count * 5);
      for (let project = 0; project < count; project++) {
        await select(project);
        for (let resource = 0; resource < 5; resource++) {
          const session = render(core, String(resource));
          expect(session).toBe(owners[project]![resource]);
          expect(session.getSnapshot()).toMatchObject({ loading: false, draft: { text: `${project}/${resource}` } });
          const release = session.retain();
          await session.query.read();
          release();
        }
      }
      expect(calls).toHaveLength(count * 5);
    } finally {
      registration.dispose();
      await core.dispose();
    }
  });
