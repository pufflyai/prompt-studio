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
    const navigationItem = extension.navigationItems?.find((item) => item.id === "font-editor");
    expect(navigationItem).toMatchObject({
      owner: { extensionId: "pstdio", kind: "mode", id: "project" },
      slot: "content",
      when: { mode: { extensionId: "pstdio", kind: "mode", id: "project" } },
      action: { kind: "page", page: { kind: "page", id: "font-editor" } },
    });
    // An ungrouped item joins the root navigation section.
    expect(navigationItem?.group).toBeUndefined();
    expect(extension.skills?.find((skill) => skill.id === "font-editor")).toMatchObject({
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
});
