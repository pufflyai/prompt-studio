import { describe, expect, test } from "bun:test";
import type { ResourceRef } from "../../registries/resources/resource-registry";
import { createWorkbenchCore } from "../../workbench-core";

const ticket: ResourceRef = { kind: "ticket", uri: "pstdio://ticket/PS-268", id: "PS-268", label: "Ticket" };
const labRoot: ResourceRef = { kind: "lab-root", uri: "pstdio://lab/root", id: "root", label: "Lab" };

const setup = () => {
  const workbench = createWorkbenchCore();
  workbench.modes.registerMode({ id: "ticket-mode", resourceKinds: ["ticket"], activate: () => undefined });
  workbench.modes.registerMode({ id: "ticket-mode-b", resourceKinds: ["ticket"], activate: () => undefined });
  workbench.modes.registerMode({
    id: "lab",
    resourceKinds: ["lab-root"],
    defaultResource: labRoot,
    activate: () => undefined,
  });

  let selected: ResourceRef | undefined;
  const scopes: (string | undefined)[] = [];
  workbench.navigator.configure({
    getProjectId: () => "project-1",
    getSelectedResource: () => selected,
    applySelection: (resource) => {
      selected = resource;
    },
    applyScope: (commit) => {
      scopes.push(`${commit.modeId}/${commit.resource?.uri ?? "empty"}`);
    },
    applyBreadcrumb: (resource) => {
      if (!resource) workbench.breadcrumbs.clearItems();
    },
    presentResource: () => undefined,
  });
  return { workbench, getSelected: () => selected, scopes };
};

describe("workbench navigator", () => {
  test("a resource-only target keeps the mode and fails on an incompatible kind without changing state", async () => {
    const { workbench, getSelected, scopes } = setup();
    await workbench.navigator.open({ modeId: "ticket-mode", resource: ticket });
    expect(getSelected()).toEqual(ticket);

    const result = await workbench.navigator.open({ resource: labRoot });

    expect(result).toMatchObject({ ok: false, code: "navigation_resource_incompatible" });
    expect(workbench.modes.getActiveModeId()).toBe("ticket-mode");
    expect(getSelected()).toEqual(ticket);
    // A failed target rotates no scope.
    expect(scopes).toHaveLength(1);
  });

  test("a mode-only target keeps a compatible resource and rotates its layout scope once", async () => {
    const { workbench, getSelected, scopes } = setup();
    await workbench.navigator.open({ modeId: "ticket-mode", resource: ticket });

    const result = await workbench.navigator.open({ modeId: "ticket-mode-b" });

    expect(result).toMatchObject({ ok: true, modeId: "ticket-mode-b" });
    expect(getSelected()).toEqual(ticket);
    expect(scopes).toEqual(["ticket-mode/pstdio://ticket/PS-268", "ticket-mode-b/pstdio://ticket/PS-268"]);
  });

  test("an incompatible mode switch restores the mode's last compatible resource", async () => {
    const { workbench, getSelected } = setup();
    await workbench.navigator.open({ modeId: "lab", resource: labRoot });
    await workbench.navigator.open({ modeId: "ticket-mode", resource: ticket });

    await workbench.navigator.open({ modeId: "lab" });

    expect(workbench.modes.getActiveModeId()).toBe("lab");
    expect(getSelected()).toEqual(labRoot);
  });

  test("an incompatible mode switch without history opens the mode's default resource", async () => {
    const { workbench, getSelected } = setup();
    await workbench.navigator.open({ modeId: "ticket-mode", resource: ticket });

    await workbench.navigator.open({ modeId: "lab" });

    expect(getSelected()).toEqual(labRoot);
  });

  test("an unknown target mode changes nothing", async () => {
    const { workbench, getSelected, scopes } = setup();
    await workbench.navigator.open({ modeId: "ticket-mode", resource: ticket });

    const result = await workbench.navigator.open({ modeId: "missing" });

    expect(result).toMatchObject({ ok: false, code: "navigation_mode_missing" });
    expect(workbench.modes.getActiveModeId()).toBe("ticket-mode");
    expect(getSelected()).toEqual(ticket);
    expect(scopes).toHaveLength(1);
  });

  test("observers see one committed pair, never an intermediate combination", async () => {
    const { workbench } = setup();
    const commits: string[] = [];
    workbench.navigator.onDidCommit((commit) => {
      commits.push(`${commit.modeId}:${commit.resource?.kind ?? "none"}`);
    });

    await workbench.navigator.open({ modeId: "ticket-mode", resource: ticket });
    await workbench.navigator.open({ modeId: "lab" });

    expect(commits).toEqual(["ticket-mode:ticket", "lab:lab-root"]);
  });

  test("forgetting a deleted resource clears per-mode last-resource state", async () => {
    const { workbench, getSelected } = setup();
    await workbench.navigator.open({ modeId: "ticket-mode", resource: ticket });
    await workbench.navigator.open({ modeId: "lab" });
    workbench.navigator.forgetResource(ticket.uri);

    await workbench.navigator.open({ modeId: "ticket-mode" });

    // No last resource and no default: the mode commits with a cleared context.
    expect(workbench.modes.getActiveModeId()).toBe("ticket-mode");
    expect(getSelected()).toBeUndefined();
  });

  test("replay commits mode and resource in one transaction", async () => {
    const { workbench, getSelected } = setup();
    await workbench.navigator.open({ modeId: "ticket-mode", resource: ticket });
    await workbench.navigator.open({ modeId: "lab" });

    const result = workbench.navigator.commitContext({
      modeId: "ticket-mode",
      resource: ticket,
      replaceActive: true,
    });

    expect(result).toMatchObject({ ok: true, modeId: "ticket-mode" });
    expect(workbench.modes.getActiveModeId()).toBe("ticket-mode");
    expect(getSelected()).toEqual(ticket);
  });
});
