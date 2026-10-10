import { expect, test } from "bun:test";
import type { WorkspaceProviderDescriptor } from "@pstdio/sdk/api";
import type { CommandParamValue } from "@pstdio/workbench/react";
import { changeWorkspaceParamValue, readWorkspace } from "./workspace-param-values";

const provider: WorkspaceProviderDescriptor = {
  id: "machines.remote",
  label: "Machine",
  params: {
    instance: {
      type: "select",
      options: {
        command: { kind: "command", id: "instances", extensionId: "machines" },
        valueField: "id",
        labelField: "name",
      },
    },
    tools: {
      type: "multi-select",
      options: {
        command: { kind: "command", id: "tools", extensionId: "machines" },
        valueField: "id",
        labelField: "name",
      },
    },
  },
};

test("keeps both selection clears when compound field updates arrive together", () => {
  let current: CommandParamValue = JSON.stringify({
    providerId: provider.id,
    params: { instance: "removed-instance", tools: ["removed-tool"] },
  });
  const input = {
    provider,
    value: current,
    onChange: (value: CommandParamValue) => {
      current = value;
    },
    onUpdateValue: (update: (value: CommandParamValue) => CommandParamValue) => {
      current = update(current);
    },
  };
  changeWorkspaceParamValue(input, "instance", "");
  changeWorkspaceParamValue(input, "tools", []);
  expect(readWorkspace(current)).toEqual({ providerId: provider.id, params: {} });
});
