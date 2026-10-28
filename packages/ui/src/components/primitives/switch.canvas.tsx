import { Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import type { ReactNode } from "react";
import { Switch } from "@/components/primitives/switch";

// The switch track uses borderRadius "md" — this is the design-system look and
// must never be changed to "full" (a fully-round pill breaks the look). The
// radius lives in packages/ui/src/theme/recipes/switch.ts, restated in the solid
// variant because Chakra's default variant would otherwise pin "full".
const meta = {
  title: "Components/Inputs/Switch",
  component: Switch,
  decorators: [
    (Story: () => ReactNode) => (
      <div style={{ padding: "24px", width: "320px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies CanvasMeta<typeof Switch>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const Default: Story = {
  id: "components-inputs-switch--default",
};
export const DefaultChecked: Story = {
  id: "components-inputs-switch--default-checked",
  args: {
    defaultChecked: true,
  },
};
export const CompactParameterToggle: Story = {
  id: "components-inputs-switch--compact-parameter-toggle",
  args: {
    size: "xs",
    defaultChecked: true,
    children: "Preserve context",
  },
};
export const WithLabel: Story = {
  id: "components-inputs-switch--with-label",
  args: {
    children: "Enable notifications",
  },
};
export const Disabled: Story = {
  id: "components-inputs-switch--disabled",
  args: {
    disabled: true,
    children: "Unavailable",
  },
};
export const DisabledChecked: Story = {
  id: "components-inputs-switch--disabled-checked",
  args: {
    disabled: true,
    defaultChecked: true,
    children: "Locked on",
  },
};
export const Sizes: Story = {
  id: "components-inputs-switch--sizes",
  render: () => (
    <Stack gap="md">
      <Switch size="sm">Small</Switch>
      <Switch size="md">Medium</Switch>
      <Switch size="lg">Large</Switch>
    </Stack>
  ),
};
export const WithTrackLabel: Story = {
  id: "components-inputs-switch--with-track-label",
  args: {
    trackLabel: { on: <Text fontSize="2xs">ON</Text>, off: <Text fontSize="2xs">OFF</Text> },
    size: "lg",
  },
};
