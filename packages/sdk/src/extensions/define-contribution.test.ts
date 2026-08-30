import { describe, expect, test } from "bun:test";
import {
  defineCommand,
  defineExtension,
  defineMode,
  defineNavigationItem,
  definePage,
  definePlacement,
  defineResourceKind,
  defineView,
  packageAsset,
  resourceMenuSlotRef,
  workbenchCommands,
  workbenchModes,
  workbenchPages,
  workbenchSlots,
} from "./index";

describe("extension contribution definitions", () => {
  test("returns local typed references for independently addressable contributions", () => {
    const view = defineView({
      id: "tickets",
      title: "Tickets",
      body: { kind: "webview", entry: packageAsset("./tickets.tsx", import.meta.url) },
    });
    const placement = definePlacement({
      id: "tickets.main",
      mode: workbenchModes.project,
      item: { kind: "view", view: view.ref },
      region: "main",
    });
    const page = definePage({
      id: "tickets",
      title: "Tickets",
      path: "tickets",
      slots: [
        { id: "board", region: "main", view: view.ref, closable: false },
        { id: "ticket", region: "main", cardinality: "many" },
      ],
      bindings: [{ resourceKind: { kind: "resource-kind", id: "ticket" }, view: view.ref, slot: "ticket" }],
    });
    const navigationItem = defineNavigationItem({
      id: "tickets",
      slot: workbenchSlots.projectNavigation,
      label: "Tickets",
      action: { kind: "page", page: page.ref },
    });
    const mode = defineMode({ id: "review", label: "Review" });
    const command = defineCommand({ id: "tickets.open", title: "Open ticket", run: async () => undefined });
    const resourceKind = defineResourceKind({
      id: "ticket",
      menuSlots: [{ id: "headerOverflow", placement: "header-overflow", access: "public" }],
    });

    expect(view.ref).toEqual({ kind: "view", id: "tickets" });
    expect(placement.ref).toEqual({ kind: "placement", id: "tickets.main" });
    expect(navigationItem.ref).toEqual({ kind: "navigation-item", id: "tickets" });
    expect(mode.ref).toEqual({ kind: "mode", id: "review" });
    expect(command.ref).toEqual({ kind: "command", id: "tickets.open" });
    expect(resourceKind.ref).toEqual({ kind: "resource-kind", id: "ticket" });
    expect(resourceMenuSlotRef(resourceKind.ref, "headerOverflow")).toEqual({
      id: "ticket.headerOverflow",
      kind: "menu",
    });
    expect(page.ref).toEqual({ kind: "page", id: "tickets" });
    expect(workbenchPages.workspaces).toEqual({ extensionId: "pstdio", kind: "page", id: "workspaces" });
    expect(workbenchCommands.switchMode).toEqual({
      extensionId: "pstdio",
      kind: "command",
      id: "workbench.action.switchMode",
    });
  });

  test("keeps contribution registries as arrays and dictionaries as records", () => {
    const command = defineCommand({ id: "tickets.open", title: "Open ticket", run: async () => undefined });
    const extension = defineExtension({
      commands: [command],
      settings: {
        properties: {
          "tickets.enabled": { type: "boolean", scope: "project", default: true },
        },
      },
    });

    expect(extension.commands).toEqual([command]);
    expect(extension.settings?.properties["tickets.enabled"]).toMatchObject({ type: "boolean" });
  });
});
