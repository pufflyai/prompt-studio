import { Box, Link, Text } from "@chakra-ui/react";
import { ListRow } from "@pstdio/ui";
import { ArrowUpRight, CircleDot, MessagesSquare } from "lucide-react";
import { type LandingView, SIDEBAR_VIEWS, SITE_LINKS, VIEW_META } from "../../content/landing-content";
import { useLandingStyles } from "../../hooks/use-landing-styles";

const EXTERNAL_LINKS = [
  { label: "Issues", icon: CircleDot, href: SITE_LINKS.issues },
  { label: "Discord", icon: MessagesSquare, href: SITE_LINKS.discord },
];

interface ResourceSidebarProps {
  activeView: LandingView;
  onNavigate: (view: LandingView) => void;
}

export const ResourceSidebar = (props: ResourceSidebarProps) => {
  const { activeView, onNavigate } = props;
  const styles = useLandingStyles();

  return (
    <Box as="nav" aria-label="Sections" css={styles.sidebar}>
      {SIDEBAR_VIEWS.map((view) => {
        const meta = VIEW_META[view];
        return (
          <ListRow
            key={view}
            icon={<meta.icon />}
            label={meta.label}
            isSelected={view === activeView}
            aria-current={view === activeView ? "page" : undefined}
            onClick={() => onNavigate(view)}
          />
        );
      })}
      <Box flex="1" />
      <Text textStyle="label/XS" color="fg.subtle" px="xs">
        GET INVOLVED
      </Text>
      {EXTERNAL_LINKS.map((link) => (
        <Link key={link.label} href={link.href} target="_blank" rel="noopener" variant="plain">
          <ListRow icon={<link.icon />} label={link.label} endContent={<ArrowUpRight size={12} />} width="full" />
        </Link>
      ))}
    </Box>
  );
};
