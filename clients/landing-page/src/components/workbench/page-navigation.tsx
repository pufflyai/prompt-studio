import { Box, Button } from "@chakra-ui/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { type LandingView, VIEW_META } from "../../content/landing-content";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { landingPathForView, nextLandingView, previousLandingView } from "../../services/landing-route";

interface PageNavigationProps {
  view: LandingView;
  onNavigate: (view: LandingView) => void;
}

export const PageNavigation = (props: PageNavigationProps) => {
  const { view, onNavigate } = props;
  const styles = useLandingStyles();
  const pages = [
    { direction: "previous", label: "Previous", view: previousLandingView(view), icon: ArrowLeft },
    { direction: "next", label: "Next", view: nextLandingView(view), icon: ArrowRight },
  ];
  return (
    <Box as="nav" aria-label="Page navigation" css={styles.heroNavigation}>
      {pages.map((page) => (
        <Button
          key={page.direction}
          asChild
          variant="outline"
          flexDirection={page.direction === "next" ? "row-reverse" : "row"}
        >
          <a
            href={landingPathForView(page.view)}
            aria-label={`${page.label}: ${VIEW_META[page.view].label}`}
            title={VIEW_META[page.view].label}
            onClick={(event) => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              onNavigate(page.view);
            }}
          >
            <page.icon />
            {page.label}
          </a>
        </Button>
      ))}
    </Box>
  );
};
