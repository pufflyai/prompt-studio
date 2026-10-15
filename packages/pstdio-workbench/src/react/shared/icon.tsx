import { Icon, type IconProps } from "@chakra-ui/react";
import { resolveIconComponent } from "@pstdio/ui";

export interface WorkbenchIconProps extends Omit<IconProps, "as" | "size"> {
  name?: string;
  size?: number | string;
}

export const WorkbenchIcon = (props: WorkbenchIconProps) => {
  const { name, size = 14, ...rest } = props;
  if (!name) return null;

  const IconComponent = resolveIconComponent(name);
  if (!IconComponent) return null;

  return (
    <Icon as={IconComponent} boxSize={typeof size === "number" ? `${size}px` : size} aria-hidden="true" {...rest} />
  );
};
