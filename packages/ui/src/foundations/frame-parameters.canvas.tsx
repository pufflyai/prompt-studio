import { Input, Stack, Text } from "@chakra-ui/react";

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
  title: "Design System/Frame parameters",
  component: Example,
  args: { amount: 2, enabled: true, treatment: "calm", time: 0 },
  controls: {
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
  },
  motion: { duration: 2, fps: 30, markers: [{ at: 1, label: "Midpoint" }] },
};
export const First = {};
export const Second = {};
