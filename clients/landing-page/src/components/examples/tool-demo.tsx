import type { ToolExampleId } from "../../content/tool-examples-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { AgentDashboardDemo } from "./agent-dashboard-demo";
import { FormulaGlossaryDemo } from "./formula-glossary-demo";
import { IconSetEditorDemo } from "./icon-set-editor-demo";

export const ToolDemo = (props: { example: ToolExampleId; highlighted?: ToolShapeKind }) => {
  const { example, highlighted } = props;
  if (example === "agents") return <AgentDashboardDemo highlighted={highlighted} />;
  if (example === "formulas") return <FormulaGlossaryDemo highlighted={highlighted} />;
  return <IconSetEditorDemo highlighted={highlighted} />;
};
