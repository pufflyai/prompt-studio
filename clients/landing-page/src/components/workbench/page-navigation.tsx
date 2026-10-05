import { Box, Button } from "@chakra-ui/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLandingStyles } from "../../hooks/use-landing-styles";

export interface PageLink {
  href: string;
  label: string;
}

interface PageNavigationProps {
  previous?: PageLink;
  next?: PageLink;
  size?: "sm" | "md";
}

/** Previous and next page links. The site's link handling opens them without a reload. */
export const PageNavigation = (props: PageNavigationProps) => {
  const { previous, next, size } = props;
  const panelStyles = useLandingStyles();
  const pages = [
    { direction: "previous", label: "Previous", link: previous, icon: ArrowLeft },
    { direction: "next", label: "Next", link: next, icon: ArrowRight },
  ];
  return (
    <Box as="nav" aria-label="Page navigation" css={panelStyles.pageNavigation}>
      {pages.map((page) => {
        if (!page.link) return null;
        return (
          <Button key={page.direction} asChild variant="ghost" size={size} data-direction={page.direction}>
            <a href={page.link.href} aria-label={`${page.label}: ${page.link.label}`}>
              <page.icon />
              {page.link.label}
            </a>
          </Button>
        );
      })}
    </Box>
  );
};
