import type { DemoCliCommand } from "./demo-cli-commands";
import type { ToolExampleId } from "./tool-examples-content";

interface InteractionTarget {
  selector: string;
  index?: number;
}
export type ToolInteraction = { agent: number } & (
  | { kind: "cli"; command: DemoCliCommand }
  | (InteractionTarget &
      ({ kind: "click" } | { kind: "type"; edit: "icon-name" | "shader" } | { kind: "key"; key: string }))
);

export const TOOL_INTERACTIONS: Record<ToolExampleId, ToolInteraction[]> = {
  icons: [
    { agent: 1, kind: "click", selector: '[data-icon-id="component"]' },
    { agent: 0, kind: "type", selector: '[aria-label="Icon name"]', edit: "icon-name" },
    { agent: 2, kind: "click", selector: 'button[type="submit"]' },
    { agent: 1, kind: "cli", command: { tool: "icons", id: "component", name: "component-glow" } },
  ],
  shaders: [
    { agent: 1, kind: "type", selector: '[aria-label="Fragment shader code"]', edit: "shader" },
    { agent: 0, kind: "key", selector: '[role="slider"][aria-label="Shader scale"]', key: "ArrowRight" },
    { agent: 2, kind: "key", selector: '[role="slider"][aria-label="Shader speed"]', key: "ArrowRight" },
    { agent: 0, kind: "cli", command: { tool: "shaders", scale: 16, speed: 1.2 } },
  ],
  agents: [
    { agent: 0, kind: "click", selector: '[data-agent-control="session"]', index: 0 },
    { agent: 2, kind: "click", selector: '[data-agent-control="session"]', index: 1 },
    { agent: 1, kind: "click", selector: '[data-agent-control="session"]', index: 2 },
    { agent: 2, kind: "cli", command: { tool: "agents", id: "TOOL-18" } },
  ],
  formulas: [
    { agent: 2, kind: "click", selector: '[aria-label="Choose a formula"] button', index: 1 },
    { agent: 0, kind: "key", selector: '[role="slider"]', key: "ArrowRight" },
    { agent: 1, kind: "click", selector: '[aria-label="Choose a formula"] button', index: 2 },
    {
      agent: 2,
      kind: "cli",
      command: { tool: "formulas", id: "loan", inputs: { principal: 300000, rate: 4, years: 20 } },
    },
  ],
};
