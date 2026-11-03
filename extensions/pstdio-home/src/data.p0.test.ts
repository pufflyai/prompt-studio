import { expect, test } from "bun:test";
import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { readHome } from "./data";

test("Home reads the selected project's setup state", async () => {
  const ctx = {
    project: { id: "project-1", name: "First project", shorthand: "P" },
    workspaces: { getDefault: async () => ({ setupError: "Setup failed" }) },
  } as unknown as ExtensionContextBase;
  const home = await readHome(ctx);
  expect(home.project).toEqual(ctx.project);
  expect(home.setupError).toBe("Setup failed");
});
