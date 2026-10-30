import { Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
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
const meta = { title: "Components/Inputs/Icon Picker", component: Picker } satisfies CanvasMeta<typeof Picker>;
export default meta;
export const ChooseIcon: CanvasVariant<typeof meta> = {
  id: "components-inputs-icon-picker--choose-icon",
};
export const Disabled: CanvasVariant<typeof meta> = {
  id: "components-inputs-icon-picker--disabled",
  args: { disabled: true },
};
