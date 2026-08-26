import { describe, expect, test } from "bun:test";
import extension from "./extension";

const command = (id: string) => extension.commands?.find((candidate) => candidate.id === id);

describe("font editor extension", () => {
  test("contributes the editor panel, tree item, commands, and agent skill", () => {
    expect(extension.views?.find((view) => view.id === "font-editor")).toMatchObject({
      body: {
        kind: "webview",
        entry: { path: "./src/views/main.tsx" },
        capabilities: ["commands.execute", "notification.show"],
      },
    });
    expect(extension.navigationItems?.find((item) => item.id === "font-editor")).toMatchObject({
      slot: { id: "project.navigation" },
      when: { mode: { extensionId: "pstdio", kind: "mode", id: "project" } },
      action: { kind: "view", view: { kind: "view", id: "font-editor" } },
    });
    expect(extension.skills?.find((skill) => skill.id === "fontEditor")).toMatchObject({
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
    for (const id of publicCommands) expect(command(id)?.cli).toBe(true);
  });

  test("routes dashboard invocations through the default repository", async () => {
    const calls: unknown[] = [];
    const result = await command("inspect")?.run(
      {
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
      } as never,
      {},
    );

    expect(result).toEqual({ family: "prompt-studio-icons", glyphs: [] });
    expect(calls).toEqual([
      {
        command: { kind: "command", id: "internal.inspect" },
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
    const addCommand = command("glyph.add");

    expect(addCommand?.params).toHaveProperty("svg");

    await addCommand?.run(
      {
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
      } as never,
      { name: "square", svg },
    );

    expect(calls).toEqual([
      {
        commandId: { kind: "command", id: "internal.glyph.add" },
        invocation: {
          params: { name: "square", svg },
          repoId: "repo-1",
          repoPath: "/repo",
        },
      },
    ]);
  });
});
