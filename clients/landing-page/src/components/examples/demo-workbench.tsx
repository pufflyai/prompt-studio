import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useStoryStyles } from "../../hooks/use-landing-styles";

export const DemoWorkbench = (props: { children: ReactNode }) => {
  const { children } = props;
  const styles = useStoryStyles();
  return <Box css={styles.visual}>{children}</Box>;
};
