import { expect, test } from "bun:test";
import extension from "../extension";
import { commands } from "./commands";

test("the ordinary extension entry loads with valid routed document and action parameters", () => {
  expect(extension.pages.find((page) => page.id === "files")?.document).toEqual({ metadataKey: "workspaceFilePath" });
  expect(extension.pages.find((page) => page.id === "files")?.slots).toEqual([]);
  expect(extension.navigationItems.map((item) => item.id)).toEqual(["files", "workspaces"]);
});

test("workspace comparison follows the provider unless the person selects a mode", () => {
  expect(extension.pages.find((page) => page.id === "workspace")?.params?.comparison).toEqual({
    type: "string",
    default: "provider",
    values: ["provider", "current", "fork_point"],
  });
});

test("webview command keys use their declared public command IDs", () => {
  for (const [key, command] of Object.entries(commands)) expect(key).toBe(command.id);
});
