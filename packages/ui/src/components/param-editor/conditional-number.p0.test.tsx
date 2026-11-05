import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { renderToStaticMarkup } from "react-dom/server";
import { psTheme } from "../../theme";
import { ParamEditor } from "./param-editor";
import { ParamEditorField } from "./param-editor-field";

test("a numeric input follows its enabling toggle without discarding the selected count", () => {
  const input = (limited: boolean) =>
    renderToStaticMarkup(
      <ChakraProvider value={psTheme}>
        <ParamEditorField
          param={{ id: "count", name: "Count", type: "number", defaultValue: 6, enabledBy: "limited" }}
          defaultValues={{ limited, count: 8 }}
          onChange={() => {}}
        />
      </ChakraProvider>,
    ).match(/<input[^>]*role="spinbutton"[^>]*>/)?.[0];
  expect(input(false)).toContain('disabled=""');
  expect(input(false)).toContain('value="8"');
  expect(input(true)).not.toContain('disabled=""');
  expect(input(true)).toContain('value="8"');
});

test("a grouped toggle's declared default enables the count unless explicitly overridden", () => {
  const render = (values?: Record<string, boolean>) =>
    renderToStaticMarkup(
      <ChakraProvider value={psTheme}>
        <ParamEditor
          groups={[
            {
              id: "options",
              title: "Options",
              params: [
                { id: "limited", name: "Limit", type: "boolean", defaultValue: true },
                { id: "count", name: "Count", type: "number", defaultValue: 6, enabledBy: "limited" },
              ],
            },
          ]}
          defaultValues={values}
        />
      </ChakraProvider>,
    ).match(/<input[^>]*role="spinbutton"[^>]*>/)?.[0];
  expect(render()).not.toContain('disabled=""');
  expect(render({ limited: false })).toContain('disabled=""');
});
