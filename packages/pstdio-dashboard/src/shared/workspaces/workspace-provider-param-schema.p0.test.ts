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

test("workspace choices retain their string fallback without starting a translation owner", () => {
  const template = workspaceProviderParamSchema({
    id: "custom",
    label: "Custom",
    params: {
      template: {
        type: "select",
        options: [
          { label: "Small", localizedLabel: { $l10n: "small" }, value: "small" },
          { label: "Large", localizedLabel: { $l10n: "large", default: "Large instance" }, value: "large" },
        ],
      },
    },
  }).template;
  expect(template).toMatchObject({
    options: [
      { label: "Small", value: "small" },
      { label: "Large instance", value: "large" },
    ],
  });
});
