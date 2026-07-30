import type { BadgeProps } from "@chakra-ui/react";
import { Badge } from "@chakra-ui/react";

export interface ChipProps extends Omit<BadgeProps, "size" | "variant"> {}

export const Chip = (props: ChipProps) => <Badge size="sm" variant="chip" {...props} />;
