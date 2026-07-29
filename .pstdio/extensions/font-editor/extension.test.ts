import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("font editor extension", () => {
  test("contributes the editor route, tree item, commands, and agent skill", () => {
    expect(extension.routes?.fontEditor).toMatchObject({
      path: "font-editor",
      webview: {
        entry: { path: "./src/views/main.tsx" },
        capabilities: ["commands.execute", "notification.show"],
      },
    });
    expect(extension.treeItems?.fontEditor).toMatchObject({
      target: "workbench.left.tree",
      action: { kind: "route", route: "font-editor" },
    });
    expect(extension.skills?.fontEditor).toMatchObject({
      source: { path: "./skills/font-editor" },
    });

    const publicCommands = [
      "inspect",
      "preview",
      "glyph.add",
      "glyph.rename",
      "glyph.codepoint",
      "glyph.remove",
      "config.get",
      "config.set",
      "build",
      "verify",
    ];
    for (const id of publicCommands) expect(extension.commands?.[id]?.cli).toBe(true);
  });

  test("routes dashboard invocations through the default repository", async () => {
    const calls: unknown[] = [];
    const result = await extension.commands?.inspect?.run({
      params: {},
      repos: {
        getDefault: async () => ({
          projectId: "project-1",
          repoId: "repo-1",
          path: "/repo",
          role: "default",
        }),
      },
      commands: {
        execute: async (command: string, invocation: unknown) => {
          calls.push({ command, invocation });
          return {
            ok: true,
            status: "success",
            value: { family: "prompt-studio-icons", glyphs: [] },
          };
        },
      },
    } as never);

    expect(result).toEqual({ family: "prompt-studio-icons", glyphs: [] });
    expect(calls).toEqual([
      {
        command: "font-editor.internal.inspect",
        invocation: {
          params: {},
          repoId: "repo-1",
          repoPath: "/repo",
        },
      },
    ]);
  });

  test("routes inline SVG content through the default repository", async () => {
    const calls: unknown[] = [];
    const svg = '<svg viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>';
    const command = extension.commands?.["glyph.add"];

    expect(command?.params).toHaveProperty("svg");

    await command?.run({
      params: { name: "square", svg },
      repos: {
        getDefault: async () => ({
          projectId: "project-1",
          repoId: "repo-1",
          path: "/repo",
          role: "default",
        }),
      },
      commands: {
        execute: async (commandId: string, invocation: unknown) => {
          calls.push({ commandId, invocation });
          return {
            ok: true,
            status: "success",
            value: { glyphCount: 221 },
          };
        },
      },
    } as never);

    expect(calls).toEqual([
      {
        commandId: "font-editor.internal.glyph.add",
        invocation: {
          params: { name: "square", svg },
          repoId: "repo-1",
          repoPath: "/repo",
        },
      },
    ]);
  });
});
