import { Icon } from "@chakra-ui/react";
import { resolveIconComponent } from "@pstdio/ui";
import { ToolCase } from "lucide-react";

interface ExtensionIconProps {
  name?: string;
  size?: "sm" | "md";
}

export const ExtensionIcon = (props: ExtensionIconProps) => {
  const { name, size = "sm" } = props;
  const Glyph = (name && resolveIconComponent(name)) || ToolCase;
  return (
    <Icon boxSize={size === "md" ? "6" : "5"}>
      <Glyph />
    </Icon>
  );
};
