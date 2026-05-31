import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("pstdio-core-project-repos", () => {
  test("registers project files in the project sidebar before default navigation", () => {
    expect(extension.treeItems?.projectFiles).toMatchObject({
      action: { kind: "route", route: "project-files" },
      icon: "Files",
      label: "Project files",
      placement: "first",
      target: "workbench.left.tree",
      when: { mode: "project" },
    });
    expect(extension.treeItems?.projectFiles).not.toHaveProperty("group");
  });

  test("exposes a project files route backed by a command-capable webview", () => {
    expect(extension.routes?.projectFiles).toMatchObject({
      label: "Project files",
      path: "project-files",
      webview: expect.objectContaining({
        capabilities: ["commands.execute"],
      }),
    });
  });
});
