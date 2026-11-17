import { expect, test } from "bun:test";
import { createResourceContextActions } from "./list-row-chrome";

test("gesture-dependent row actions start on selection and ordinary actions wait for menu closure", () => {
  const calls: string[] = [];
  const [copy, ordinary] = createResourceContextActions([
    {
      id: "copy",
      label: "Copy",
      runOnSelect: true,
      onAction: () => {
        calls.push("copy");
      },
    },
    {
      id: "ordinary",
      label: "Ordinary",
      onAction: () => {
        calls.push("ordinary");
      },
    },
  ]);
  copy?.onSelect?.();
  expect(calls).toEqual(["copy"]);
  expect(copy?.onClick).toBeUndefined();
  expect(ordinary?.onSelect).toBeUndefined();
  ordinary?.onClick?.();
  expect(calls).toEqual(["copy", "ordinary"]);
});
