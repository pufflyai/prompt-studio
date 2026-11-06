import { Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { ReactNode } from "react";
import { Switch } from "@/components/primitives/switch";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";

// The switch track uses borderRadius "md" — this is the design-system look and
// must never be changed to "full" (a fully-round pill breaks the look). The
// radius lives in packages/ui/src/theme/recipes/switch.ts, restated in the solid
// variant because Chakra's default variant would otherwise pin "full".
const meta = {
  title: "Design system/Components/Forms/Switch",
  component: Switch,
  decorators: [
    (Story: () => ReactNode) => (
      <div style={{ padding: "24px", width: "320px" }}>
        <Story />
      </div>
    ),
  ],
} satisfies CanvasMeta<typeof Switch>;
export default {
  title: "Design system/Components/Forms/Switch",
  fullscreen: true,
};
type Story = CanvasFrame<typeof meta>;
const Default: Story = {
  id: "components-inputs-switch--default",
};
const DefaultChecked: Story = {
  id: "components-inputs-switch--default-checked",
  args: {
    defaultChecked: true,
  },
};
const CompactParameterToggle: Story = {
  id: "components-inputs-switch--compact-parameter-toggle",
  args: {
    size: "xs",
    defaultChecked: true,
    children: "Preserve context",
  },
};
const WithLabel: Story = {
  id: "components-inputs-switch--with-label",
  args: {
    children: "Enable notifications",
  },
};
const Disabled: Story = {
  id: "components-inputs-switch--disabled",
  args: {
    disabled: true,
    children: "Unavailable",
  },
};
const DisabledChecked: Story = {
  id: "components-inputs-switch--disabled-checked",
  args: {
    disabled: true,
    defaultChecked: true,
    children: "Locked on",
  },
};
const Sizes: Story = {
  id: "components-inputs-switch--sizes",
  render: () => (
    <Stack gap="md">
      <Switch size="sm">Small</Switch>
      <Switch size="md">Medium</Switch>
      <Switch size="lg">Large</Switch>
    </Stack>
  ),
};
const WithTrackLabel: Story = {
  id: "components-inputs-switch--with-track-label",
  args: {
    trackLabel: { on: <Text fontSize="2xs">ON</Text>, off: <Text fontSize="2xs">OFF</Text> },
    size: "lg",
  },
};

const Examples = createCanvasExampleNavigator(meta, {
  Default,
  DefaultChecked,
  CompactParameterToggle,
  WithLabel,
  Disabled,
  DisabledChecked,
  Sizes,
  WithTrackLabel,
});
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as Default };
