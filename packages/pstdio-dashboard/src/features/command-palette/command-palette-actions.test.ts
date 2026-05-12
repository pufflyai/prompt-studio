import { describe, expect, it } from "bun:test";
import type { useNavigate } from "@tanstack/react-router";
import { runCommandPaletteAction } from "./command-palette-actions";

const createContext = (events: string[]) => ({
  projectId: "project-1",
  navigate: (({ to }: { to?: string }) => {
    if (to) events.push(`navigate:${to}`);
  }) as ReturnType<typeof useNavigate>,
  beginThemePreview: () => {
    events.push("theme-preview");
  },
  commitThemePreview: (preference: string) => {
    events.push(`theme:${preference}`);
  },
  closePalette: () => {
    events.push("close");
  },
  requestCreateTicket: () => {
    events.push("create-ticket");
  },
  createSession: () => {
    events.push("create-session");
  },
  openShortcutHelp: () => {
    events.push("shortcut-help");
  },
  runExtensionCommand: (commandId: string) => {
    events.push(`extension:${commandId}`);
  },
  runShellCommand: (commandId: string, args: unknown) => {
    events.push(`shell:${commandId}:${JSON.stringify(args)}`);
  },
});

describe("runCommandPaletteAction", () => {
  it("closes the palette and executes shell commands", () => {
    const events: string[] = [];

    runCommandPaletteAction(
      {
        id: "shell:project.openSettings",
        type: "shell-command",
        commandId: "project.openSettings",
        args: { projectId: "project-1" },
      },
      createContext(events),
    );

    expect(events).toEqual(["close", 'shell:project.openSettings:{"projectId":"project-1"}']);
  });
});
