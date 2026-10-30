import { expect, test } from "bun:test";
import { indexExamples } from "./indexer";

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
