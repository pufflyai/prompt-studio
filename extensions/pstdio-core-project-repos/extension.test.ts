import { describe, expect, test } from "bun:test";
import extension from "./extension";

describe("pstdio-core-project-repos", () => {
  test("registers project files in the project sidebar before default navigation", () => {
    expect(extension.navigation?.projectFiles).toMatchObject({
      icon: "Files",
      label: "Project files",
      placement: "first",
      route: "project-files",
      slot: expect.objectContaining({ id: "project.sidebarNav" }),
    });
    expect(extension.navigation?.projectFiles).not.toHaveProperty("group");
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
