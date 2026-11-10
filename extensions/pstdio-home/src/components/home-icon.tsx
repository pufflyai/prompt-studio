import { Icon } from "@chakra-ui/react";
import { resolveIconComponent } from "@pstdio/ui";

export const HomeIcon = (props: { name: string; size?: number }) => {
  const { name, size } = props;
  const boxSize = size === undefined ? "4" : `${size}px`;
  if (name.startsWith("data:image/svg+xml;base64,")) {
    return (
      <Icon boxSize={boxSize} colorScheme="light" _dark={{ colorScheme: "dark" }} aria-hidden="true" asChild>
        <img src={name} alt="" />
      </Icon>
    );
  }
  const component = resolveIconComponent(name);
  return component ? <Icon as={component} boxSize={boxSize} aria-hidden="true" /> : null;
};
