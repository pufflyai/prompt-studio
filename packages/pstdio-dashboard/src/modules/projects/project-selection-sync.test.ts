import { describe, expect, test } from "bun:test";
import { createWorkbenchCore, type WorkbenchSnapshot } from "@pstdio/workbench";
import { getDashboardSelectedResource, selectDashboardNavigationResource } from "@/shared/app/navigation-state";
import { selectDashboardProject } from "@/shared/app/project-context";
import { createProjectsModule } from "./module";

// Harvested from PS-258: a mode switch must never keep an incompatible resource or
// rotate persistence into a stale resource scope.
describe("project mode navigation sync", () => {
  test("clears an incompatible resource before switching mode persistence scopes", async () => {
    const snapshots = new Map<string | undefined, WorkbenchSnapshot>();
    const workbench = createWorkbenchCore({
      persistence: {
        getSnapshot: (scope) => snapshots.get(scope),
        setSnapshot: (snapshot, scope) => snapshots.set(scope, structuredClone(snapshot)),
      },
    });
    workbench.registerModule(createProjectsModule());
    workbench.modes.registerMode({
      id: "ticket",
      label: "Ticket",
      resourceKinds: ["ticket"],
      activate: () => undefined,
    });
    workbench.modes.registerMode({ id: "lab", label: "Lab", resourceKinds: [], activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const ticket = {
      kind: "ticket",
      uri: "pstdio://ticket/PS-258",
      id: "PS-258",
      label: "Fix mode switch",
    };
    selectDashboardNavigationResource(workbench, ticket, { modeId: "ticket" });
    workbench.breadcrumbs.setItems([{ title: ticket.label, resource: ticket }]);

    await workbench.commands.executeCommand("workbench.action.switchMode", { modeId: "lab" });

    expect(getDashboardSelectedResource(workbench)).toBeUndefined();
    expect(workbench.breadcrumbs.getItems()).toBeUndefined();
    expect(workbench.host.getPersistenceScope()).toBe("project/project-1/mode/lab/view/empty");
    expect([...snapshots.keys()]).not.toContain("project/project-1/mode/lab/resource/pstdio://ticket/PS-258");
  });

  test("keeps a resource when the next mode presents its kind", async () => {
    const workbench = createWorkbenchCore();
    workbench.registerModule(createProjectsModule());
    workbench.modes.registerMode({ id: "ticket-a", resourceKinds: ["ticket"], activate: () => undefined });
    workbench.modes.registerMode({ id: "ticket-b", resourceKinds: ["ticket"], activate: () => undefined });
    selectDashboardProject(workbench, { id: "project-1", name: "Prompt Studio" });
    const ticket = { kind: "ticket", uri: "pstdio://ticket/PS-258", id: "PS-258" };
    selectDashboardNavigationResource(workbench, ticket, { modeId: "ticket-a" });

    await workbench.commands.executeCommand("workbench.action.switchMode", { modeId: "ticket-b" });

    expect(getDashboardSelectedResource(workbench)).toEqual(ticket);
    expect(workbench.host.getPersistenceScope()).toBe(
      "project/project-1/mode/ticket-b/resource/pstdio://ticket/PS-258",
    );
  });
});
