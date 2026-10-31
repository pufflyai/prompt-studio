import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CanvasThemeContext, composePreview } from "./index";

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
  const wrap = (name: string) => (Preview: () => unknown) => createElement("section", { id: name }, Preview() as never);
  const result = await composePreview(
    { decorators: [wrap("variant")] },
    { render: () => createElement("content"), decorators: [wrap("module")] },
    { decorators: [wrap("project")] },
  );
  expect(renderToStaticMarkup(createElement(result.Component, {}))).toBe(
    '<section id="project"><section id="module"><section id="variant"><content></content></section></section></section>',
  );
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

test("a frame's description and full-page height come from plain fields", async () => {
  const framed = await composePreview({ description: "Wide layout" }, { fullscreen: true });
  expect(framed.description).toBe("Wide layout");
  expect(framed.fullscreen).toBe(true);
  const plain = await composePreview({ fullscreen: false }, {}, { fullscreen: true });
  expect(plain.description).toBeUndefined();
  expect(plain.fullscreen).toBe(false);
});

test("decorators receive the frame's theme", async () => {
  const preview = await composePreview(() => createElement("p", null, "body"), {
    decorators: [(Frame, context) => createElement("main", { "data-theme": context.theme }, Frame())],
  });
  const markup = (theme?: "dark") => {
    const frame = createElement(preview.Component, {});
    return renderToStaticMarkup(theme ? createElement(CanvasThemeContext.Provider, { value: theme }, frame) : frame);
  };
  expect(markup()).toBe('<main data-theme="light"><p>body</p></main>');
  expect(markup("dark")).toBe('<main data-theme="dark"><p>body</p></main>');
});
