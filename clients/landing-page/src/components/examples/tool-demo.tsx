import type { ToolExampleId } from "../../content/tool-examples-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { AgentDashboardDemo } from "./agent-dashboard-demo";
import { FontEditorDemo } from "./font-editor-demo";

export const ToolDemo = (props: { example: ToolExampleId; highlighted?: ToolShapeKind }) => {
  const { example, highlighted } = props;
  if (example === "agents") return <AgentDashboardDemo highlighted={highlighted} />;
  return <FontEditorDemo highlighted={highlighted} />;
};
