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

test("toggle edits enable dependent fields without a caller echo and follow external values", async () => {
  const { act, create } = await import("react-test-renderer");
  const { useParamEditorValues } = await import("./param-editor-values");
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previousAct = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  let form!: ReturnType<typeof useParamEditorValues>;
  const Capture = (props: { limited: boolean; onChange?: () => void }) => {
    form = useParamEditorValues(
      [
        { id: "limited", name: "Limit", type: "boolean", defaultValue: false },
        { id: "count", name: "Count", type: "number", defaultValue: 6, enabledBy: "limited" },
      ],
      [],
      { limited: props.limited, count: 8 },
      props.onChange,
    );
    return null;
  };
  let editor: ReturnType<typeof create> | undefined;
  try {
    for (const onChange of [undefined, () => {}]) {
      await act(async () => {
        editor = create(<Capture limited={false} onChange={onChange} />);
      });
      expect(form.values.limited).toBe(false);
      await act(async () => form.onChange("limited", true));
      expect(form.values.limited).toBe(true);
      await act(async () => editor!.update(<Capture limited={false} onChange={onChange} />));
      expect(form.values.limited).toBe(true);
      await act(async () => form.onChange("count", 9));
      await act(async () => editor!.update(<Capture limited onChange={onChange} />));
      expect(form.values.count).toBe(9);
      await act(async () => editor!.update(<Capture limited={false} onChange={onChange} />));
      expect(form.values.limited).toBe(false);
      expect(form.values.count).toBe(9);
      await act(async () => editor!.unmount());
      editor = undefined;
    }
  } finally {
    if (editor) await act(async () => editor!.unmount());
    if (previousAct === undefined) delete environment.IS_REACT_ACT_ENVIRONMENT;
    else environment.IS_REACT_ACT_ENVIRONMENT = previousAct;
  }
});
