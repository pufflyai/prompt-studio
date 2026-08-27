import { describe, expect, test } from "bun:test";
import {
  defineCommand,
  defineExtension,
  defineMode,
  defineNavigationItem,
  definePlacement,
  defineResourceKind,
  defineResourceView,
  defineView,
  packageAsset,
  resourceMenuSlotRef,
  resourceSlotRef,
  workbenchCommands,
  workbenchModes,
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
    const navigationItem = defineNavigationItem({
      id: "tickets",
      slot: workbenchSlots.projectNavigation,
      label: "Tickets",
      action: { kind: "view", view: view.ref },
    });
    const mode = defineMode({ id: "review", label: "Review" });
    const command = defineCommand({ id: "tickets.open", title: "Open ticket", run: async () => undefined });
    const resourceKind = defineResourceKind({
      id: "ticket",
      surface: "primary",
      slots: [{ id: "primary", cardinality: "one", access: "owner" }],
      menuSlots: [{ id: "headerOverflow", placement: "header-overflow", access: "public" }],
    });
    const resourceView = defineResourceView({
      id: "ticket.editor",
      resourceKind: resourceKind.ref,
      slot: resourceSlotRef(resourceKind.ref, "primary"),
      view: view.ref,
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
    expect(resourceView.ref).toEqual({ kind: "resource-view", id: "ticket.editor" });
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
