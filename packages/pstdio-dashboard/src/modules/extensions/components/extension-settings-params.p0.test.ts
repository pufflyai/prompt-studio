import { describe, expect, test } from "bun:test";
import type { ExtensionSettingValueRecord } from "@pstdio/sdk/api";
import { settingChangeValue, settingsToParamSchema, settingsToParams } from "./extension-settings-params";

const branch: ExtensionSettingValueRecord = {
  key: "implementation.defaultTargetBranch",
  extensionId: "pstdio.pstdio-planner",
  type: "string",
  scope: "project",
  default: "",
  title: "Default target branch",
  options: {
    commandId: "pstdio.pstdio-planner.command.implementation-targets",
    valueField: "branch",
    labelField: "branch",
  },
  value: "origin/release",
  source: "stored",
};

describe("extension settings with command options", () => {
  test("show as a searchable, clearable selection of the loaded options", () => {
    const states = {
      [branch.key]: {
        key: "request",
        status: "ready" as const,
        options: [
          { value: "origin/main", label: "origin/main" },
          { value: "origin/release", label: "origin/release" },
        ],
      },
    };

    expect(settingsToParams([branch], states)).toEqual([
      {
        id: branch.key,
        name: "Default target branch",
        description: undefined,
        type: "selection",
        defaultValue: "origin/release",
        options: [
          { id: "origin/main", name: "origin/main" },
          { id: "origin/release", name: "origin/release" },
        ],
        searchable: true,
        clearable: true,
        disabled: false,
      },
    ]);
  });

  test("keep a saved value that the options no longer list", () => {
    const states = {
      [branch.key]: {
        key: "request",
        status: "ready" as const,
        options: [{ value: "origin/main", label: "origin/main" }],
      },
    };

    expect(settingsToParams([branch], states)).toEqual([
      expect.objectContaining({
        defaultValue: "origin/release",
        options: [
          { id: "origin/main", name: "origin/main" },
          { id: "origin/release", name: "origin/release" },
        ],
      }),
    ]);
  });

  test("stay inert while the options load", () => {
    const states = { [branch.key]: { key: "request", status: "loading" as const, options: [] } };

    expect(settingsToParams([branch], states)).toEqual([
      expect.objectContaining({ disabled: true, options: [{ id: "origin/release", name: "origin/release" }] }),
    ]);
  });

  test("can still be changed or cleared when the options fail to load", () => {
    const states = { [branch.key]: { key: "request", status: "error" as const, options: [], error: "git failed" } };

    expect(settingsToParams([branch], states)).toEqual([expect.objectContaining({ disabled: false })]);
  });

  test("load their options with the declared command and pass other settings with their types", () => {
    const limit: ExtensionSettingValueRecord = { ...branch, key: "branch.limit", type: "number", options: undefined };

    expect(settingsToParamSchema([branch, limit])).toEqual({
      [branch.key]: { type: "select", options: branch.options },
      "branch.limit": { type: "number" },
    });
  });

  test("remove the saved value when the selection is cleared", () => {
    expect(settingChangeValue([branch], branch.key, "")).toBeUndefined();
    expect(settingChangeValue([branch], branch.key, "origin/main")).toBe("origin/main");
  });
});
