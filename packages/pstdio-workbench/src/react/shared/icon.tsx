import { Icon, type IconProps } from "@chakra-ui/react";
import type { LucideIcon } from "lucide-react";
import * as lucideIcons from "lucide-react";

interface WorkbenchIconProps extends Omit<IconProps, "as" | "size"> {
  name?: string;
  size?: number | string;
}

const toPascalCase = (value: string) =>
  value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");

const resolveLucideIcon = (name: string) => {
  const pascalName = toPascalCase(name);
  const candidates = [name, pascalName, `${pascalName}Icon`];

  for (const candidate of candidates) {
    const IconComponent = (lucideIcons as Record<string, unknown>)[candidate];
    if (IconComponent && (typeof IconComponent === "function" || typeof IconComponent === "object")) {
      return IconComponent as LucideIcon;
    }
  }

  return undefined;
};

export const WorkbenchIcon = (props: WorkbenchIconProps) => {
  const { name, size = 14, ...rest } = props;
  if (!name) return null;

  const LucideIcon = resolveLucideIcon(name);
  if (!LucideIcon) return null;

  return <Icon as={LucideIcon} boxSize={typeof size === "number" ? `${size}px` : size} aria-hidden="true" {...rest} />;
};
