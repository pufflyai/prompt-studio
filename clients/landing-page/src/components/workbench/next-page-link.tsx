import { Box, Icon, Link, Text } from "@chakra-ui/react";
import { ArrowRight } from "lucide-react";
import { type LandingView, VIEW_META } from "../../content/landing-content";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { landingPathForView, nextLandingView } from "../../services/landing-route";

interface NextPageLinkProps {
  view: LandingView;
  onNavigate: (view: LandingView) => void;
}

export const NextPageLink = (props: NextPageLinkProps) => {
  const { view, onNavigate } = props;
  const next = nextLandingView(view);
  const styles = useStoryStyles();
  return (
    <Box as="nav" aria-label="Continue exploring" css={styles.pageNavigation}>
      <Link
        variant="underline"
        color="fg"
        textStyle="label/M/medium"
        href={landingPathForView(next)}
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          onNavigate(next);
        }}
      >
        <Text>{next === "start" ? "Back to Start Here" : `Next: ${VIEW_META[next].label}`}</Text>
        <Icon as={ArrowRight} boxSize="icon-sm" />
      </Link>
    </Box>
  );
};
