import { Icon } from "@chakra-ui/react";
import { resolveIconComponent } from "@pstdio/ui";

export const HomeIcon = (props: { name: string; size?: number }) => {
  const { name, size } = props;
  const component = resolveIconComponent(name);
  return component ? <Icon as={component} boxSize={size === undefined ? "4" : `${size}px`} aria-hidden="true" /> : null;
};
