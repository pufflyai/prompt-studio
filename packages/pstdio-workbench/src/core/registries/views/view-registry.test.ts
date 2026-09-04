import { describe, expect, test } from "bun:test";
import type { WorkbenchPanelContribution } from "../layout/layout-model";
import { createViewRegistry } from "./view-registry";

const createHost = () => {
  const registeredBodies: string[] = [];
  const disposedBodies: string[] = [];
  const registeredPanels: WorkbenchPanelContribution[] = [];
  const disposedPanels: string[] = [];

  return {
    registeredBodies,
    disposedBodies,
    registeredPanels,
    disposedPanels,
    registerBody: (view: { id: string }) => {
      registeredBodies.push(view.id);
      return {
        rendererId: `${view.id}.renderer`,
        dispose: () => disposedBodies.push(view.id),
      };
    },
    registerPanel: (panel: WorkbenchPanelContribution) => {
      registeredPanels.push(panel);
      return { dispose: () => disposedPanels.push(panel.id) };
    },
  };
};

describe("createViewRegistry", () => {
  test("registers reusable content without creating a panel", () => {
    const host = createHost();
    const views = createViewRegistry(host);
    const registration = views.registerView(
      {
        id: "pstdio-planner.tickets",
        title: "Tickets",
        icon: "Ticket",
        body: { kind: "react", render: () => "tickets" },
      },
      { ownerId: "pstdio-planner", source: "extension", priority: 10 },
    );

    expect(host.registeredBodies).toEqual(["pstdio-planner.tickets"]);
    expect(host.registeredPanels).toEqual([]);
    expect(views.getView("pstdio-planner.tickets")).toMatchObject({
      id: "pstdio-planner.tickets",
      ownerId: "pstdio-planner",
      source: "extension",
    });

    registration.dispose();
    expect(views.getView("pstdio-planner.tickets")).toBeUndefined();
    expect(host.disposedPanels).toEqual([]);
    expect(host.disposedBodies).toEqual(["pstdio-planner.tickets"]);
  });

  test("does not accept placement presentation", () => {
    const host = createHost();
    const views = createViewRegistry(host);
    views.registerView({
      id: "project-picker",
      title: "Projects",
      body: { kind: "react", render: () => "projects" },
    });

    expect(host.registeredPanels).toEqual([]);
    expect(views.getView("project-picker")?.body).toEqual({
      kind: "react",
      render: expect.any(Function),
    });
  });

  test("rejects duplicate view identities before registering another body", () => {
    const host = createHost();
    const views = createViewRegistry(host);
    views.registerView({ id: "tickets", title: "Tickets", body: { kind: "react", render: () => null } });

    expect(() =>
      views.registerView({ id: "tickets", title: "Duplicate", body: { kind: "react", render: () => null } }),
    ).toThrow("View already registered: tickets");
    expect(host.registeredBodies).toEqual(["tickets"]);
  });
});
