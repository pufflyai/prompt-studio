import { Icon } from "@chakra-ui/react";
import { resolveIconComponent } from "@pstdio/ui";
import { ToolCase } from "lucide-react";

interface ExtensionIconProps {
  name?: string;
  size?: "sm" | "md";
}

export const ExtensionIcon = (props: ExtensionIconProps) => {
  const { name, size = "sm" } = props;
  if (name?.startsWith("data:image/svg+xml;base64,")) {
    return (
      <Icon boxSize={size === "md" ? "6" : "5"} colorScheme="light" _dark={{ colorScheme: "dark" }} asChild>
        <img src={name} alt="" />
      </Icon>
    );
  }
  const Glyph = (name && resolveIconComponent(name)) || ToolCase;
  return (
    <Icon boxSize={size === "md" ? "6" : "5"}>
      <Glyph />
    </Icon>
  );
};
