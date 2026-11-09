import { expect, test } from "bun:test";
import { Input } from "@chakra-ui/react";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { act, create } from "react-test-renderer";
import { MarmaladePropertyInput } from "./marmalade-property-input";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
test("property text previews immediately, commits once on blur and Escape cancels without a save", async () => {
  const previews: string[] = [];
  const commits: string[] = [];
  let cancelled = 0;
  let view!: ReturnType<typeof create>;
  await act(async () => {
    view = create(
      <ChakraProvider value={psTheme}>
        <MarmaladePropertyInput
          id="text"
          label="Text"
          value="Before"
          onPreview={(value) => {
            previews.push(value);
          }}
          onEdit={(value) => {
            commits.push(value);
          }}
          onCancel={() => {
            cancelled++;
          }}
        />
      </ChakraProvider>,
    );
  });
  const input = () => view.root.findByType(Input);
  await act(async () => {
    input().props.onFocus();
    input().props.onChange({ target: { value: "Draft" } });
  });
  expect(previews).toEqual(["Draft"]);
  expect(commits).toEqual([]);
  await act(async () => {
    input().props.onBlur();
  });
  expect(commits).toEqual(["Draft"]);
  await act(async () => {
    input().props.onFocus();
    input().props.onChange({ target: { value: "Cancelled" } });
  });
  let prematureInputActions = 0;
  await act(async () => {
    for (const key of ["Enter", "Escape"]) {
      for (const nativeEvent of [{ isComposing: true }, { keyCode: 229 }]) {
        input().props.onKeyDown({
          key,
          nativeEvent,
          preventDefault: () => prematureInputActions++,
          stopPropagation: () => prematureInputActions++,
          currentTarget: { blur: () => prematureInputActions++ },
        });
      }
    }
  });
  expect(prematureInputActions).toBe(0);
  expect(cancelled).toBe(0);
  expect(input().props.value).toBe("Cancelled");
  await act(async () => {
    input().props.onKeyDown({ key: "Escape", nativeEvent: {}, preventDefault() {}, stopPropagation() {} });
    input().props.onBlur();
  });
  expect(cancelled).toBe(1);
  expect(commits).toEqual(["Draft"]);
  await act(async () => {
    input().props.onChange({ target: { value: "Retained on defocus" } });
  });
  await act(async () => {
    view.unmount();
  });
  expect(commits).toEqual(["Draft", "Retained on defocus"]);
});

test("partial numeric input stays local and cannot commit invalid values", async () => {
  const previews: string[] = [];
  const commits: string[] = [];
  let cancelled = 0;
  let view!: ReturnType<typeof create>;
  await act(async () => {
    view = create(
      <ChakraProvider value={psTheme}>
        <MarmaladePropertyInput
          id="number"
          label="Width"
          type="number"
          min={1}
          value={20}
          onPreview={(value) => {
            previews.push(value);
          }}
          onEdit={(value) => {
            commits.push(value);
          }}
          onCancel={() => {
            cancelled++;
          }}
        />
      </ChakraProvider>,
    );
  });
  const input = () => view.root.findByType(Input);
  await act(async () => {
    input().props.onFocus();
    input().props.onChange({ target: { value: "-" } });
  });
  await act(async () => {
    input().props.onBlur();
  });
  expect(previews).toEqual([]);
  expect(commits).toEqual([]);
  expect(cancelled).toBe(1);
  expect(input().props.value).toBe("-");
  expect(input().props["aria-invalid"]).toBe(true);
  await act(async () => {
    view.unmount();
  });
});
