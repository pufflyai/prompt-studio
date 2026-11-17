import { expect, test } from "bun:test";
import type { ControlValue } from "@pstdio/sdk/extensions";
import { controlParamSchema } from "pstdio-api-contracts";
import type { CommandParamFieldProps } from "../../command-palette/command-param-field";
import { HarnessControl } from "./harness-control";

test("public native harness controls keep identity and saved-request constraints while forwarding editable settings", () => {
  const param = controlParamSchema.parse({
    id: "provider",
    name: "Provider",
    type: "harness",
    defaultValue: { harnessId: "" },
    lockIdentity: true,
    preserveSettings: true,
    settingsMode: "resolved",
  });
  if (param.type !== "harness") throw new Error("Expected harness control");
  let field: CommandParamFieldProps | undefined;
  let updated: ControlValue | undefined;
  HarnessControl({
    param,
    value: { harnessId: "saved", model: "unadvertised-B", params: { thinking: "high" } },
    readOnly: false,
    renderParamField: (props) => {
      field = props;
      return <span />;
    },
    onChange: (value) => {
      updated = value;
    },
  });
  expect(field?.harness).toEqual({ lockIdentity: true, preserveSettings: true, settingsMode: "resolved" });
  expect(field?.disabled).toBe(false);
  field!.onChange(JSON.stringify({ harnessId: "saved", model: "unadvertised-B", params: { thinking: "low" } }));
  expect(updated).toEqual({ harnessId: "saved", model: "unadvertised-B", params: { thinking: "low" } });
});
