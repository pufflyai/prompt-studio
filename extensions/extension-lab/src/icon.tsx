import { Icon, type IconProps } from "@chakra-ui/react";
import { CircleHelp, icons } from "lucide-react";

interface ExampleIconProps extends Omit<IconProps, "size"> {
  name: string;
  size?: number;
}
export const ExampleIcon = (props: ExampleIconProps) => {
  const { name, size = 16, ...rest } = props;
  const Component = icons[name as keyof typeof icons] ?? CircleHelp;
  return <Icon as={Component} boxSize={`${size}px`} flexShrink={0} {...rest} />;
};
