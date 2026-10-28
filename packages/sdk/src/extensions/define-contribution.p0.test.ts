import { describe, expect, test } from "bun:test";
import {
  defineCommand,
  defineExtension,
  defineMode,
  defineNavigationItem,
  defineNavigationTree,
  definePage,
  definePlacement,
  defineResourceKind,
  defineSettingsPanel,
  defineView,
  packageAsset,
  resourceMenuSlotRef,
  workbenchModes,
  workbenchPages,
  workbenchSlots,
} from "./index";

describe("extension contribution definitions", () => {
  test("declares app-wide panels and device settings through the public SDK", () => {
    const view = defineView({
      id: "account",
      title: "Account",
      body: { kind: "webview", entry: packageAsset("./account.tsx", import.meta.url) },
    });
    const panel = defineSettingsPanel({ id: "account", view: view.ref, slot: workbenchSlots.globalSettings });
    const extension = defineExtension({
      views: [view],
      settingsPanels: [panel],
      settings: { properties: { capacity: { type: "number", scope: "device", default: 2 } } },
    });
    expect(extension.settingsPanels?.[0]?.slot.id).toBe("global.settings");
    expect(extension.settings?.properties.capacity.scope).toBe("device");
  });
  test("returns local typed references for independently addressable contributions", () => {
    const view = defineView({
      id: "tickets",
      title: "Tickets",
      body: { kind: "webview", entry: packageAsset("./tickets.tsx", import.meta.url) },
    });
    const placement = definePlacement({
      id: "tickets.main",
      mode: workbenchModes.project,
      item: { kind: "view", view: view.ref, presence: "open" },
      region: "main",
    });
    const page = definePage({
      id: "tickets",
      title: "Tickets",
      path: "tickets",
      mode: workbenchModes.project,
      main: {
        kind: "view",
        view: view.ref,
        cardinality: "one",
      },
      slots: [
        {
          id: "details",
          region: "side",
          item: {
            kind: "view",
            view: view.ref,
            presence: "open",
          },
        },
      ],
    });
    const navigationItem = defineNavigationItem({
      id: "tickets",
      owner: workbenchModes.project,
      slot: "content",
      label: "Tickets",
      action: { kind: "page", page: page.ref },
    });
    const navigationTree = defineNavigationTree({
      id: "ticket-files",
      owner: page.ref,
      slot: "content",
      view: view.ref,
    });
    const mode = defineMode({ id: "review", label: "Review", regions: ["main"] });
    const command = defineCommand({ id: "tickets.open", title: "Open ticket", run: async () => undefined });
    const resourceKind = defineResourceKind({
      id: "ticket",
      menuSlots: [{ id: "headerOverflow", placement: "header-overflow", access: "public" }],
    });
    expect(view.ref).toEqual({ kind: "view", id: "tickets" });
    expect(placement.ref).toEqual({ kind: "placement", id: "tickets.main" });
    expect(page.ref).toEqual({ kind: "page", id: "tickets" });
    expect(page.panels.details).toEqual({
      kind: "page-slot",
      page: { kind: "page", id: "tickets" },
      id: "details",
    });
    expect(navigationItem.ref).toEqual({ kind: "navigation-item", id: "tickets" });
    expect(navigationTree.ref).toEqual({ kind: "navigation-tree", id: "ticket-files" });
    expect(mode.ref).toEqual({ kind: "mode", id: "review" });
    expect(command.ref).toEqual({ kind: "command", id: "tickets.open" });
    expect(resourceKind.ref).toEqual({ kind: "resource-kind", id: "ticket" });
    expect(resourceMenuSlotRef(resourceKind.ref, "headerOverflow")).toEqual({
      id: "ticket.headerOverflow",
      kind: "menu",
    });
    expect(workbenchPages.start).toEqual({ extensionId: "pstdio", kind: "page", id: "start" });
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
