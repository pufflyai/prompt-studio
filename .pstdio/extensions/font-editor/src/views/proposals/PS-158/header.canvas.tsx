import { Badge, HStack, Stack } from "@chakra-ui/react";
import { useState } from "react";
import { IconSetChooser } from "./icon-set-chooser";

export default { title: "Proposals/PS-158 Icon Set header" };
export const Header = () => {
  const [value, setValue] = useState("all");
  return (
    <Stack align="start" p="md">
      <IconSetChooser family="prompt-studio-icons" value={value} disabled={false} onChange={setValue} />
      <HStack>
        <Badge>{value === "all" ? 229 : 10} glyphs</Badge>
      </HStack>
    </Stack>
  );
};
