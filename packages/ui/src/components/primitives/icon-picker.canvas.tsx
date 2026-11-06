import { Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useState } from "react";
import { createCanvasExampleNavigator } from "@/docs/canvas-example-navigator";
import { IconPicker } from "./icon-picker";

const Picker = (props: { disabled?: boolean }) => {
  const [icon, setIcon] = useState<string | null>("folder");
  return (
    <Stack p="lg" align="start">
      <IconPicker value={icon} onChange={setIcon} disabled={props.disabled} />
      <Text role="status">{icon}</Text>
    </Stack>
  );
};
const meta = { title: "Design system/Components/Forms/Icon picker", component: Picker } satisfies CanvasMeta<
  typeof Picker
>;
export default {
  title: "Design system/Components/Forms/Icon picker",
  fullscreen: true,
};
const ChooseIcon: CanvasFrame<typeof meta> = {
  id: "components-inputs-icon-picker--choose-icon",
};
const Disabled: CanvasFrame<typeof meta> = {
  id: "components-inputs-icon-picker--disabled",
  args: { disabled: true },
};

const Examples = createCanvasExampleNavigator(meta, { ChooseIcon, Disabled });
const ExamplePage = { name: "Explore", render: () => <Examples /> };

export { ExamplePage as ChooseIcon };
