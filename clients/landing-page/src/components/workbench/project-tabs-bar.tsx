import { Box, chakra, HStack, IconButton, Text } from "@chakra-ui/react";
import { BookOpen, Maximize2, Menu, Minimize2, Minus, Newspaper, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { SiteSection } from "../../content/landing-pages";
import { useLandingStyles } from "../../hooks/use-landing-styles";
import { trackWindowControlClicked } from "../../services/landing-analytics";
import { PromptStudioIcon } from "../icons/prompt-studio-icon";
import { ActionMenuButton } from "./action-menu-button";

const SITE_TABS: { section: SiteSection; label: string; icon: React.ReactNode }[] = [
  { section: "studio", label: "Prompt Studio", icon: <PromptStudioIcon /> },
  { section: "docs", label: "Docs", icon: <BookOpen /> },
  { section: "blog", label: "Blog", icon: <Newspaper /> },
];

interface SiteTabsProps {
  selected: SiteSection;
  sectionPath: (section: SiteSection) => string;
}

// Website tabs have no close button, so each keeps its content width.
const SiteTabs = (props: SiteTabsProps) => {
  const { selected, sectionPath } = props;
  const styles = useLandingStyles();
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tabs = tabsRef.current!;
    const revealSelected = () => {
      tabs.querySelector(`[data-section="${selected}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    };
    revealSelected();
    const observer = new ResizeObserver(revealSelected);
    observer.observe(tabs);
    return () => observer.disconnect();
  }, [selected]);

  return (
    <HStack as="nav" ref={tabsRef} aria-label="Site" css={styles.siteTabs}>
      {SITE_TABS.map((tab) => (
        <chakra.a
          key={tab.section}
          href={sectionPath(tab.section)}
          data-section={tab.section}
          css={styles.siteTab}
          aria-current={tab.section === selected ? "page" : undefined}
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <Box css={styles.siteTabIcon} aria-hidden="true">
            {tab.icon}
          </Box>
          <Text as="span" css={styles.siteTabLabel}>
            {tab.label}
          </Text>
        </chakra.a>
      ))}
    </HStack>
  );
};

interface ProjectTabsBarProps extends SiteTabsProps {
  windowed: boolean;
  onToggleWindowed: () => void;
  onTitleBarPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onTitleBarDoubleClick: () => void;
  actionMenuOpen: boolean;
  onOpenActionMenu: () => void;
}

export const ProjectTabsBar = (props: ProjectTabsBarProps) => {
  const {
    windowed,
    selected,
    sectionPath,
    onToggleWindowed,
    onTitleBarPointerDown,
    onTitleBarDoubleClick,
    actionMenuOpen,
    onOpenActionMenu,
  } = props;

  const styles = useLandingStyles(windowed);
  const controls = [
    { id: "close", label: "Close", icon: X, disabled: windowed },
    { id: "minimize", label: "Minimize", icon: Minus, disabled: windowed },
    {
      id: "zoom",
      label: windowed ? "Expand window" : "Collapse window",
      icon: windowed ? Maximize2 : Minimize2,
      disabled: false,
    },
  ] as const;

  return (
    <>
      <Box css={styles.mobileTitlebar}>
        <chakra.a href="/" css={styles.siteTab} aria-label="Prompt Studio home">
          <Box css={styles.siteTabIcon}>
            <PromptStudioIcon />
          </Box>
          <Text as="span" css={styles.siteTabLabel}>
            Prompt Studio
          </Text>
        </chakra.a>
        <IconButton
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
          aria-expanded={actionMenuOpen}
          variant="ghost"
          size="sm"
          onClick={onOpenActionMenu}
        >
          <Menu />
        </IconButton>
      </Box>
      <Box css={styles.titlebar} onPointerDown={onTitleBarPointerDown} onDoubleClick={onTitleBarDoubleClick}>
        <Box
          className="group"
          css={styles.windowControls}
          onPointerDown={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          {controls.map((control) => (
            <chakra.button
              key={control.id}
              type="button"
              css={styles.windowControl}
              data-control={control.id}
              disabled={control.disabled}
              aria-label={control.label}
              title={control.label}
              onClick={() => {
                trackWindowControlClicked(control.id, windowed);
                onToggleWindowed();
              }}
            >
              <control.icon strokeWidth={3} />
            </chakra.button>
          ))}
        </Box>
        <SiteTabs selected={selected} sectionPath={sectionPath} />
        <ActionMenuButton open={actionMenuOpen} onOpen={onOpenActionMenu} />
      </Box>
    </>
  );
};
