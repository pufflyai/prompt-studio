import { Box, Text } from "@chakra-ui/react";
import { BookOpen, Newspaper, Scale } from "lucide-react";
import { VIEW_META } from "../../content/landing-content";
import type { LandingPage } from "../../content/landing-pages";
import { useLandingStyles } from "../../hooks/use-landing-styles";

const pageIcon = (page: LandingPage) => {
  if (page.view in VIEW_META) return VIEW_META[page.view as keyof typeof VIEW_META].icon;
  if (page.view === "legal") return Scale;
  if (page.view === "blog" || page.view === "post") return Newspaper;
  return BookOpen;
};

interface WorkbenchNavProps {
  page: LandingPage;
  onOpenNavigation: () => void;
}

/** On small screens, where the sidebar is hidden, the current page name opens the palette. */
export const WorkbenchNav = (props: WorkbenchNavProps) => {
  const { page, onOpenNavigation } = props;
  const Icon = pageIcon(page);

  const styles = useLandingStyles();

  return (
    <Box as="button" aria-label="Open navigation" css={styles.mobileNav} onClick={onOpenNavigation}>
      <Icon size={14} />
      <Text fontFamily="heading" fontWeight="medium" textStyle="label/M/medium" truncate>
        {page.label}
      </Text>
    </Box>
  );
};
