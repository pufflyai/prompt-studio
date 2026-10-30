import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CanvasThemeContext, composePreview } from "./index";

test("decorators wrap in preview, canvas, frame order and args merge", () => {
  const wrap = (name: string) => (Preview: () => unknown) => createElement("section", { id: name }, Preview() as never);
  const result = composePreview(
    { args: { value: 1 }, decorators: [wrap("variant")] },
    { render: () => createElement("content"), args: { label: "Default", value: 0 }, decorators: [wrap("module")] },
    { decorators: [wrap("project")] },
  );
  expect(result.args).toEqual({ label: "Default", value: 1 });
  expect(renderToStaticMarkup(createElement(result.Component, {}))).toBe(
    '<section id="project"><section id="module"><section id="variant"><content></content></section></section></section>',
  );
});

test("a frame's description and full-page height come from plain fields", () => {
  const framed = composePreview({ description: "Wide layout" }, { fullscreen: true });
  expect(framed.description).toBe("Wide layout");
  expect(framed.fullscreen).toBe(true);
  const plain = composePreview({ fullscreen: false }, { fullscreen: true });
  expect(plain.description).toBeUndefined();
  expect(plain.fullscreen).toBe(false);
});

test("decorators receive the frame's theme", () => {
  const preview = composePreview(() => createElement("p", null, "body"), {
    decorators: [(Frame, context) => createElement("main", { "data-theme": context.theme }, Frame())],
  });
  const markup = (theme?: "dark") => {
    const frame = createElement(preview.Component, {});
    return renderToStaticMarkup(theme ? createElement(CanvasThemeContext.Provider, { value: theme }, frame) : frame);
  };
  expect(markup()).toBe('<main data-theme="light"><p>body</p></main>');
  expect(markup("dark")).toBe('<main data-theme="dark"><p>body</p></main>');
});
