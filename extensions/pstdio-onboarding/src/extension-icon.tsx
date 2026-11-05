import { Icon } from "@chakra-ui/react";
import { resolveIconComponent } from "@pstdio/ui";
import { ToolCase } from "lucide-react";

interface ExtensionIconProps {
  name?: string;
  size?: "xs" | "sm" | "md";
}

export const ExtensionIcon = (props: ExtensionIconProps) => {
  const { name, size = "sm" } = props;
  const boxSize = { xs: "icon-xs", sm: "5", md: "6" }[size];
  if (name?.startsWith("data:image/svg+xml;base64,")) {
    return (
      <Icon boxSize={boxSize} colorScheme="light" _dark={{ colorScheme: "dark" }} asChild>
        <img src={name} alt="" />
      </Icon>
    );
  }
  const Glyph = (name && resolveIconComponent(name)) || ToolCase;
  return (
    <Icon boxSize={boxSize}>
      <Glyph />
    </Icon>
  );
};
