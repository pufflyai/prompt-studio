import { Box, type BoxProps, useSlotRecipe } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface PopoverHeaderProps extends Omit<BoxProps, "title" | "children"> {
  icon: ReactNode;
  /** Use Popover.Title here when the header lives inside a Chakra popover. */
  title: ReactNode;
  actions?: ReactNode;
}

export const PopoverHeader = (props: PopoverHeaderProps) => {
  const { icon, title, actions, ...rest } = props;
  const recipe = useSlotRecipe({ key: "popoverHeader" });
  const styles = recipe();
  return (
    <Box css={styles.root} {...rest}>
      <Box css={styles.icon} aria-hidden="true">
        {icon}
      </Box>
      <Box css={styles.title}>{title}</Box>
      {actions ? <Box css={styles.actions}>{actions}</Box> : null}
    </Box>
  );
};
