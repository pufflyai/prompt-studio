import { describe, expect, test } from "bun:test";
import type { CommandExecuteResponse } from "@pstdio/sdk/api";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { workbenchCommandPaletteMenuPath } from "@pstdio/workbench/core";
import { renderToString } from "react-dom/server";
import type { ExtensionBenchLoadResponse } from "../lib/api-contract";
import { ContributionExplorer } from "./contribution-explorer";
import { createPreviewWorkbench } from "./workbench-preview";

const baseBench = {
  benchId: "bench-1",
  inventory: { fileIconThemes: [], skills: [], templateTypes: [], templates: [], themes: [] },
  metadata: {
    commands: [],
    commandPaletteContributions: [],
    dataRenderers: [],
    diagnostics: [],
    extensions: [{ id: "lab", name: "lab", displayName: "Lab", sourcePath: "" }],
    menuContributions: [],
    modes: [],
    navigation: [],
    routes: [],
    settingsDefinitions: [],
    settingsPanels: [],
    treeItems: [],
    treeRenderers: [],
    views: [],
  },
  projectId: "project-1",
  resources: [],
  sourcePath: "./extensions/extension-lab",
  summary: {
    commands: 0,
    diagnostics: 0,
    extensions: 1,
    keybindings: 0,
    skills: 0,
    templateTypes: 0,
    templates: 0,
    treeRenderers: 0,
    views: 0,
  },
} satisfies ExtensionBenchLoadResponse;

const defaultExecuteCommand = async (commandId: string) =>
  ({
    commandId,
    extensionId: "lab",
    outcome: { ok: true, status: "success", value: null },
  }) satisfies CommandExecuteResponse;

const createTestWorkbench = (
  bench: ExtensionBenchLoadResponse,
  executeCommand: (commandId: string) => Promise<CommandExecuteResponse> = defaultExecuteCommand,
) =>
  createPreviewWorkbench({
    bench,
    executeCommand,
    getLastCommand: () => null,
    getThemePreference: () => "system",
    lastCommand: null,
    onCommandCall: () => undefined,
    publishLastCommand: (commandId, response) => ({
      commandId,
      extensionId: response.extensionId,
      outcome: response.outcome,
      tick: 1,
    }),
    setThemePreference: () => undefined,
    themePreference: "system",
  });

describe("createPreviewWorkbench", () => {
  test("scripted terminal sessions open, echo writes, resize, and kill without spawning a shell", async () => {
    const workbench = createTestWorkbench(baseBench);
    expect(workbench.terminal.isAvailable()).toBe(true);

    const { sessionId } = await workbench.terminal.open({ request: { cols: 80, rows: 24 } });
    const output: string[] = [];
    const exits: unknown[] = [];
    workbench.terminal.subscribe(sessionId, {
      onData: (chunk) => output.push(new TextDecoder().decode(chunk)),
      onExit: (exit) => exits.push(exit),
    });

    // The scripted bridge delivers the initial banner to the first subscriber
    // and echoes writes back; kill emits a deterministic exit event.
    await Bun.sleep(0);
    expect(output.join("")).toContain("pstdio extension testbench (scripted terminal)");

    workbench.terminal.write({ sessionId, data: "hello" });
    await Bun.sleep(0);
    expect(output.join("")).toContain("hello");

    workbench.terminal.resize({ sessionId, cols: 100, rows: 30 });
    await workbench.terminal.kill({ sessionId, signal: "SIGTERM" });

    expect(exits).toEqual([{ code: null, signal: "SIGTERM" }]);
    expect(workbench.terminal.getSession(sessionId)?.status).toBe("killed");
  });

  test("registers the host-owned terminal panel widget", () => {
    const workbench = createTestWorkbench(baseBench);
    expect(workbench.layout.getWidget("workbench.terminal")).toMatchObject({ area: "secondary" });
  });

  test("only registers explicitly contributed command palette entries", () => {
    const workbench = createTestWorkbench({
      ...baseBench,
      metadata: {
        ...baseBench.metadata,
        commands: [
          { id: "lab.visible", extensionId: "lab", title: "Visible" },
          { id: "lab.hidden", extensionId: "lab", title: "Hidden" },
        ],
        commandPaletteContributions: [
          {
            id: "lab.visible.palette.0",
            commandId: "lab.visible",
            extensionId: "lab",
            label: "Visible",
            group: "Lab",
          },
        ],
      },
    });

    const commandIds = workbench.layout.listMenuItems(workbenchCommandPaletteMenuPath).map((item) => item.commandId);

    expect(commandIds).toContain("workbench.extension.palette.lab.visible.palette.0");
    expect(commandIds).not.toContain("lab.visible");
    expect(commandIds).not.toContain("lab.hidden");
  });

  test("registers loaded resources for command palette search", () => {
    const workbench = createTestWorkbench({
      ...baseBench,
      resources: [
        {
          resource: {
            kind: "ticket",
            uri: "pstdio://extension-resource/ticket/PS-16",
            id: "PS-16",
            label: "PS-16 Tree renderer preview",
            icon: "component",
          },
          group: "Tickets",
        },
      ],
    });

    expect(workbench.resources.listResources("PS-16")).toEqual([
      {
        resource: {
          kind: "ticket",
          uri: "pstdio://extension-resource/ticket/PS-16",
          id: "PS-16",
          label: "PS-16 Tree renderer preview",
          icon: "component",
        },
        group: "Tickets",
      },
    ]);
  });

  test("registers loaded themes for workbench theme selection", () => {
    const workbench = createTestWorkbench({
      ...baseBench,
      inventory: {
        ...baseBench.inventory,
        themes: [
          {
            id: "extension-lab.glassLab",
            extensionId: "pstdio.extension-lab",
            title: "Glass Lab",
            format: "vscode-color-theme",
            mode: "dark",
            sourcePath: "./themes/glass-lab-color-theme.json",
            tokens: { "colors.bg": "#07100F" },
            monacoTheme: { base: "vs-dark", inherit: true, rules: [], colors: {} },
          },
        ],
      },
    });

    expect(workbench.themes.listThemes()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "extension-lab.glassLab",
          mode: "dark",
          title: "Glass Lab",
          tokens: { "colors.bg": "#07100F" },
        }),
      ]),
    );
  });

  test("surfaces extension command rejections as workbench notifications", async () => {
    const workbench = createTestWorkbench(
      {
        ...baseBench,
        metadata: {
          ...baseBench.metadata,
          commands: [{ id: "lab.reject", extensionId: "lab", title: "Reject" }],
        },
      },
      async (commandId) => ({
        commandId,
        extensionId: "lab",
        outcome: {
          ok: false,
          status: "rejected",
          code: "sentience_rejected",
          reason: "That artifact remains safely inert.",
        },
      }),
    );

    await expect(workbench.commands.executeCommand("lab.reject")).rejects.toThrow(
      "That artifact remains safely inert.",
    );
    expect(workbench.notifications.listNotifications()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          level: "warning",
          message: "That artifact remains safely inert.",
          ownerId: "lab",
        }),
      ]),
    );
  });
});

describe("ContributionExplorer", () => {
  test("renders keybinding and diagnostic contribution menus", async () => {
    const workbench = createTestWorkbench(baseBench);

    const html = renderToString(
      <ChakraProvider value={psTheme}>
        <ContributionExplorer
          bench={{
            ...baseBench,
            metadata: {
              ...baseBench.metadata,
              diagnostics: [
                {
                  code: "duplicate_keybinding_chord",
                  severity: "warning",
                  message: "Duplicate keybinding",
                },
              ],
              keybindings: [
                {
                  id: "lab.preview",
                  extensionId: "lab",
                  commandId: "lab.preview",
                  key: "mod+shift+p",
                  canonicalChord: "Mod+Shift+P",
                  parsed: { key: "P", ctrl: false, shift: true, alt: false, meta: true, modifiers: ["mod", "shift"] },
                },
              ],
            },
          }}
          resource={{ kind: "ticket", uri: "pstdio://ticket/PS-18", id: "PS-18", label: "PS-18" }}
          workbench={workbench}
        />
      </ChakraProvider>,
    );

    expect(html).toContain("Keybindings (1)");
    expect(html).toContain("Diagnostics (1)");
  });
});
