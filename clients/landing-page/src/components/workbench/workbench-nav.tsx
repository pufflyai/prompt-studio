import { Box, Text } from "@chakra-ui/react";
import { type LandingView, VIEW_META } from "../../content/landing-content";
import { useLandingStyles } from "../../hooks/use-landing-styles";

interface WorkbenchNavProps {
  activeView: LandingView;
  onOpenNavigation: () => void;
}

export const WorkbenchNav = (props: WorkbenchNavProps) => {
  const { activeView, onOpenNavigation } = props;
  const viewMeta = VIEW_META[activeView];

  const styles = useLandingStyles();

  return (
    <Box as="button" aria-label="Open navigation" css={styles.mobileNav} onClick={onOpenNavigation}>
      <viewMeta.icon size={14} />
      <Text fontFamily="heading" fontWeight="medium" textStyle="label/M/medium">
        {viewMeta.label}
      </Text>
    </Box>
  );
};
