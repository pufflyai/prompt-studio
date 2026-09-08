import type { ToolShapeKind } from "../shapes/tool-shapes";
import { AgentDashboardDemo } from "./agent-dashboard-demo";
import { FontEditorDemo } from "./font-editor-demo";
import type { ToolExampleId } from "./tool-examples-content";

export const ToolDemo = (props: { example: ToolExampleId; highlighted?: ToolShapeKind }) => {
  const { example, highlighted } = props;
  if (example === "agents") return <AgentDashboardDemo highlighted={highlighted} />;
  return <FontEditorDemo highlighted={highlighted} />;
};
