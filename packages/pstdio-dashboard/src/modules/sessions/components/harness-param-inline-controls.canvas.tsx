import { Flex } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import type { HarnessParamValues } from "@pstdio/ui/param-editor";
import { useState } from "react";
import { HarnessParamInlineControls } from "./harness-param-inline-controls";

const meta = {
  title: "Sessions/Harness Inline Controls",
  component: HarnessParamInlineControls,
  args: {
    schema: {
      effort: {
        type: "select",
        label: "Reasoning effort",
        defaultValue: "medium",
        options: [
          { label: "None", value: "none", icon: "CircleSlash" },
          { label: "Minimal", value: "minimal", icon: "level-low" },
          { label: "Low", value: "low", icon: "level-low" },
          { label: "Medium", value: "medium", icon: "level-mid" },
          { label: "High", value: "high", icon: "level-high" },
          { label: "Extra high", value: "xhigh", icon: "level-xhigh" },
          { label: "Max", value: "max", icon: "flame" },
          { label: "Ultra", value: "ultra", icon: "flame" },
        ],
      },
    },
    overrides: {},
    onOverridesChange: () => {},
  },
  render: (props) => {
    const [overrides, setOverrides] = useState<HarnessParamValues>(props.overrides);
    return <HarnessParamInlineControls {...props} overrides={overrides} onOverridesChange={setOverrides} />;
  },
} satisfies CanvasMeta<typeof HarnessParamInlineControls>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const EffortLevels: Story = {
  id: "sessions-harness-inline-controls--effort-levels",
};
export const Speed: Story = {
  id: "sessions-harness-inline-controls--speed",
  args: {
    schema: {
      service_tier: {
        type: "select",
        label: "Speed",
        description: "Fast mode uses more of your Codex allowance.",
        defaultValue: "default",
        options: [
          { label: "Standard", value: "default", icon: "Snail" },
          { label: "Fast", value: "fast", icon: "Zap" },
        ],
      },
    },
  },
};
export const RememberedEffort: Story = {
  id: "sessions-harness-inline-controls--remembered-effort",
  args: { overrides: { effort: "high" } },
};
export const BooleanControl: Story = {
  id: "sessions-harness-inline-controls--boolean-control",
  args: {
    schema: {
      enabled: {
        type: "boolean",
        label: "Enabled",
        description: "Enable this harness option.",
        defaultValue: false,
      },
    },
  },
};
export const Tooltips: Story = {
  id: "sessions-harness-inline-controls--tooltips",
};
export const CommandOwnedPlan: Story = {
  id: "sessions-harness-inline-controls--command-owned-plan",
  args: {
    schema: {
      ...meta.args.schema,
      collaboration: {
        type: "select",
        control: "command",
        defaultValue: "plan",
        options: [
          { label: "Default", value: "default" },
          { label: "Plan", value: "plan" },
        ],
      },
    },
  },
};
export const LevelColors: Story = {
  id: "sessions-harness-inline-controls--level-colors",
  render: (props) => (
    <Flex gap="4" wrap="wrap">
      {meta.args.schema.effort.options.map((option) => (
        <HarnessParamInlineControls key={option.value} {...props} overrides={{ effort: option.value }} />
      ))}
    </Flex>
  ),
};
export const ChangeEffort: Story = {
  id: "sessions-harness-inline-controls--change-effort",
};
export const ChangeEffortWithKeyboard: Story = {
  id: "sessions-harness-inline-controls--change-effort-with-keyboard",
};
export const Disabled: Story = {
  id: "sessions-harness-inline-controls--disabled",
  args: { disabled: true },
};
