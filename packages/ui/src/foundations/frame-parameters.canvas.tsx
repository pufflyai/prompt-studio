import { Input, Stack, Text } from "@chakra-ui/react";
import type { CanvasControls } from "@pstdio/canvas";

interface ExampleProps {
  amount: number;
  enabled: boolean;
  treatment: string;
  time: number;
}
const Example = (props: ExampleProps) => (
  <Stack p="md">
    <Input aria-label="Frame draft" placeholder="Try a draft" />
    <Text data-parameters-preview>{JSON.stringify(props)}</Text>
  </Stack>
);
export default {
  title: "Extensions/UI Canvas/Frame parameters",
  component: Example,
  args: { amount: 2, enabled: true, treatment: "calm", time: 0 },
};
const controls: CanvasControls = {
  amount: { type: "number", label: "Amount", min: 0, max: 10, step: 1 },
  enabled: { type: "boolean", label: "Enabled" },
  treatment: {
    type: "select",
    label: "Treatment",
    options: [
      { value: "calm", label: "Calm" },
      { value: "bright", label: "Bright" },
    ],
  },
};
const motion = { duration: 2, fps: 30, markers: [{ at: 1, label: "Midpoint" }] };
export const First = { controls, motion, description: "Editable controls with motion." };
export const Second = { controls, motion };
export const Still = { controls };
export const Plain = { name: "No parameters" };
export const Motion = { name: "Motion only", motion };
