import { resolveIconComponent } from "@pstdio/ui";

export const HomeIcon = (props: { name: string; size?: number }) => {
  const { name, size } = props;
  const Icon = resolveIconComponent(name);
  return Icon ? <Icon size={size} /> : null;
};
