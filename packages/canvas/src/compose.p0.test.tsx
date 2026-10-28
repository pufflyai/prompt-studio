import { expect, test } from "bun:test";
import { createElement, type ReactElement } from "react";
import { composePreview } from "./index";

test("each preview owns its setup, args, and cleanup", async () => {
  let created = 0;
  let disposed = 0;
  const variant = {
    setup: () => ({
      args: { value: ++created },
      dispose: () => {
        disposed++;
      },
    }),
  };
  const meta = { component: () => null, args: { label: "Default", value: 0 } };
  const first = await composePreview(variant, meta);
  const second = await composePreview(variant, meta);
  expect(first.args).toEqual({ label: "Default", value: 1 });
  expect(second.args.value).toBe(2);
  first.dispose();
  first.dispose();
  expect(disposed).toBe(1);
  second.dispose();
  expect(disposed).toBe(2);
});

test("providers wrap in project, module, variant order and failed setup is reported", async () => {
  const wrap = (name: string) => (Preview: () => unknown) => createElement(name, null, Preview() as never);
  const result = await composePreview(
    { decorators: [wrap("variant")] },
    { render: () => createElement("content"), decorators: [wrap("module")] },
    { decorators: [wrap("project")] },
  );
  const tree = result.Component({}) as ReactElement<any>;
  expect(tree.type).toBe("project");
  expect(tree.props.children.type).toBe("module");
  expect(tree.props.children.props.children.type).toBe("variant");
  await expect(
    composePreview(
      {
        setup: async () => {
          throw new Error("fixture failed");
        },
      },
      {},
    ),
  ).rejects.toThrow("fixture failed");
});
