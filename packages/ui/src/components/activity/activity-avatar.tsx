import { Avatar, Box } from "@chakra-ui/react";
import type { ReactNode } from "react";

import type { ActivityActor } from "./activity.types";

export interface ActivityAvatarProps {
  actor?: ActivityActor;
  icon?: ReactNode;
  color?: string;
  background?: string;
}

export const ActivityAvatar = (props: ActivityAvatarProps) => {
  const { actor, icon, color = "fg.muted", background = "bg.muted" } = props;

  if (icon) {
    return (
      <Box
        boxSize="18px"
        borderRadius="full"
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
        color={color}
        background={background}
      >
        {icon}
      </Box>
    );
  }

  return (
    <Avatar.Root size="2xs" flexShrink={0}>
      <Avatar.Image src={actor?.avatarSrc} alt={actor?.avatarAlt ?? actor?.name} />
      <Avatar.Fallback name={actor?.name} background={background} color={color} />
    </Avatar.Root>
  );
};
