import { expect, test } from "bun:test";
import { indexExamples } from "./indexer";

test("indexes an authored theme default for each variant", () => {
  const source = `const meta = {title:'Themes',defaultTheme:'pstdio-dark'}; export default meta;
export const Inherited = {id:'themes--inherited'};
export const Contrast = {id:'themes--contrast',defaultTheme:'prompt-contrast-light'};`;
  expect(indexExamples("themes.canvas.tsx", source).stories).toMatchObject([
    { id: "themes--inherited", defaultTheme: "pstdio-dark" },
    { id: "themes--contrast", defaultTheme: "prompt-contrast-light" },
  ]);
});

test("indexes stable variants without treating exported helpers as examples", () => {
  const source = `import { Button } from './button';
const meta = {title:'Controls/Button',component:Button}; export default meta;
export const Default = {id:'controls-button--default',name:'Primary',args:{}};
export const helper = () => 42;`;
  expect(indexExamples("button.canvas.tsx", source)).toEqual({
    title: "Controls/Button",
    component: "Button",
    componentImport: "./button",
    stories: [{ exportName: "Default", id: "controls-button--default", name: "Primary" }],
  });
});
