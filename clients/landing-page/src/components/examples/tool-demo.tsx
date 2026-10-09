import { Suspense } from "react";
import { AURORA_SHADER } from "../../content/shader-demo-content";
import type { ToolExampleId } from "../../content/tool-examples-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { AgentDemo, FormulaDemo, ShaderDemo } from "../../services/landing-modules";
import { IconSetEditorDemo } from "./icon-set-editor-demo";

export const ToolDemo = (props: { example: ToolExampleId; highlighted?: ToolShapeKind }) => {
  const { example, highlighted } = props;
  if (example === "shaders")
    return (
      <Suspense fallback={null}>
        <ShaderDemo.Component shader={AURORA_SHADER} withControls highlighted={highlighted} />
      </Suspense>
    );
  if (example === "agents")
    return (
      <Suspense fallback={null}>
        <AgentDemo.Component highlighted={highlighted} />
      </Suspense>
    );
  if (example === "formulas")
    return (
      <Suspense fallback={null}>
        <FormulaDemo.Component highlighted={highlighted} />
      </Suspense>
    );
  return <IconSetEditorDemo highlighted={highlighted} />;
};
