import { Box, Link, Text } from "@chakra-ui/react";
import { ListRow, ScrollArea } from "@pstdio/ui";
import { ArrowUpRight, CircleDot, MessagesSquare } from "lucide-react";
import { Suspense } from "react";
import { SIDEBAR_VIEWS, SITE_LINKS, VIEW_META } from "../../content/landing-content";
import type { LandingPage } from "../../content/landing-pages";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { BlogNavigation, DocsNavigation } from "../../services/landing-modules";
import { landingPathForView, sectionForPage } from "../../services/landing-route";

const EXTERNAL_LINKS = [
  { label: "Issues", icon: CircleDot, href: SITE_LINKS.issues },
  { label: "Discord", icon: MessagesSquare, href: SITE_LINKS.discord },
];

const StudioSidebar = (props: { page: LandingPage }) => {
  const { page } = props;
  return SIDEBAR_VIEWS.map((view) => {
    const meta = VIEW_META[view];
    return (
      <ListRow
        key={view}
        icon={<meta.icon />}
        label={meta.label}
        href={landingPathForView(view)}
        role="link"
        isSelected={view === page.view}
        aria-current={view === page.view ? "page" : undefined}
      />
    );
  });
};

interface ResourceSidebarProps {
  page: LandingPage;
  pages: LandingPage[];
  onNavigate: (path: string) => void;
}

/** Each title bar tab has its own sidebar. */
export const ResourceSidebar = (props: ResourceSidebarProps) => {
  const { page, pages, onNavigate } = props;
  const styles = useLandingStyles();
  const section = sectionForPage(page);

  return (
    <Box as="nav" aria-label="Sections" css={styles.sidebar}>
      <ScrollArea css={styles.sidebarScroll}>
        <Box css={styles.sidebarRows}>
          {section === "studio" && <StudioSidebar page={page} />}
          <Suspense fallback={null}>
            {section === "docs" && <DocsNavigation.Component page={page} pages={pages} onNavigate={onNavigate} />}
            {section === "blog" && <BlogNavigation.Component page={page} pages={pages} />}
          </Suspense>
        </Box>
      </ScrollArea>
      <Box css={styles.sidebarFooter}>
        <Text css={styles.sidebarHeading}>GET INVOLVED</Text>
        {EXTERNAL_LINKS.map((link) => (
          <Link key={link.label} href={link.href} target="_blank" rel="noopener" variant="plain">
            <ListRow icon={<link.icon />} label={link.label} endContent={<ArrowUpRight size={12} />} width="full" />
          </Link>
        ))}
      </Box>
    </Box>
  );
};
