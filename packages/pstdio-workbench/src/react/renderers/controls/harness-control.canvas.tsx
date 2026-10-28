import { Box } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { ParamEditor } from "@pstdio/ui/param-editor";
import { useState } from "react";
import type { CommandParamFieldProps } from "../../command-palette/command-param-field";
import { HarnessControl } from "./harness-control";

const SampleHarnessField = (props: CommandParamFieldProps) => {
  const { value, disabled, onChange } = props;
  const agent = JSON.parse(String(value));
  return (
    <ParamEditor
      readOnly={disabled}
      params={[
        {
          id: "model",
          name: "Model",
          type: "selection",
          defaultValue: agent.model,
          options: [{ id: "research", name: "Research model" }],
          group: {
            id: "harnessId",
            name: "Harness",
            defaultValue: agent.harnessId,
            options: [{ id: "codex", name: "Codex" }],
          },
        },
        {
          id: "effort",
          name: "Reasoning effort",
          type: "selection",
          defaultValue: agent.params.effort,
          options: [
            { id: "medium", name: "Medium" },
            { id: "high", name: "High" },
          ],
        },
      ]}
      onChange={(id, next) =>
        onChange(JSON.stringify(id === "effort" ? { ...agent, params: { effort: next } } : { ...agent, [id]: next }))
      }
    />
  );
};
const ResearchAgent = (props: { readOnly?: boolean }) => {
  const { readOnly = false } = props;
  const initial = { harnessId: "codex", model: "research", params: { effort: "high" } };
  const [value, setValue] = useState<Parameters<typeof HarnessControl>[0]["value"]>(initial);
  return (
    <Box maxW="3xl">
      <HarnessControl
        param={{ id: "agent", name: "Model", type: "harness", defaultValue: initial }}
        value={value}
        onChange={setValue}
        readOnly={readOnly}
        renderParamField={(field) => <SampleHarnessField {...field} />}
      />
    </Box>
  );
};
const meta = { title: "pstdio-workbench/Controls/Research agent", component: ResearchAgent } satisfies CanvasMeta<
  typeof ResearchAgent
>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Editable: Story = {
  id: "pstdio-workbench-controls-research-agent--editable",
};
export const ReadOnly: Story = {
  id: "pstdio-workbench-controls-research-agent--read-only",
  args: { readOnly: true },
};
