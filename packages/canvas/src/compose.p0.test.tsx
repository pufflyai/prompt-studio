import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { type CanvasTheme, CanvasThemeContext, composePreview } from "./index";

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
    decorators: [
      (Frame, { theme }) =>
        createElement(
          "main",
          { "data-theme": theme.id, "data-mode": theme.mode, "data-bg": theme.tokens?.bg },
          Frame(),
        ),
    ],
  });
  const markup = (theme?: CanvasTheme) => {
    const frame = createElement(preview.Component, {});
    return renderToStaticMarkup(theme ? createElement(CanvasThemeContext.Provider, { value: theme }, frame) : frame);
  };
  expect(markup()).toBe('<main data-theme="light" data-mode="light"><p>body</p></main>');
  // A host theme reaches decorators unchanged, including its own tokens.
  expect(markup({ id: "dracula", mode: "dark", tokens: { bg: "#282a36" } })).toBe(
    '<main data-theme="dracula" data-mode="dark" data-bg="#282a36"><p>body</p></main>',
  );
});
