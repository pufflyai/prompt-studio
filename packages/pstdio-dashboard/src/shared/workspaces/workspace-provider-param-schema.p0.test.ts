import { expect, test } from "bun:test";
import { workspaceProviderParamSchema, workspaceProviderText } from "./workspace-provider-param-schema";

test("workspace provider label/default projection needs no runtime or browser storage owner", () => {
  expect(workspaceProviderText("External type")).toBe("External type");
  expect(workspaceProviderText({ $l10n: "provider.type", default: "External type" })).toBe("External type");
  expect(workspaceProviderText({ $l10n: "provider.type" })).toBe("provider.type");
  expect(workspaceProviderText(undefined)).toBe("");
  expect(
    workspaceProviderParamSchema({
      id: "custom",
      label: "Custom",
      params: { template: { type: "text", label: "Template", defaultValue: "small" } },
    }).template,
  ).toMatchObject({ label: "Template", defaultValue: "small" });
});
