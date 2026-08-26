import { Palette, type PaletteEntry, useThemePreference } from "@pstdio/ui";
import { ArrowUpRight, Copy, GitBranch, Github, MessagesSquare, PanelLeft, SunMoon } from "lucide-react";
import {
  INSTALL_COMMANDS,
  type LandingView,
  PROJECT_TABS,
  type ProjectTabId,
  SITE_LINKS,
  VIEW_META,
} from "./landing-content";

const VIEW_SEARCH_TEXT: Record<LandingView, string> = {
  start: "home landing start here",
  "why-prompt-studio": "why Prompt Studio value proposition workflow tools differentiation",
  gallery: "extensions gallery marketplace install",
  concepts: "concepts documentation how it works",
  documentation: "project documentation architecture product extensions references decisions lessons",
  "guide-getting-started": "guide install setup project agent getting started",
  "guide-create-ticket": "guide create plan ticket workflow",
  "guide-implement-ticket": "guide ticket implement delegate merge workspace",
  "guide-create-proposal": "guide proposal architecture design change",
  "guide-create-sub-tickets": "guide split break down parent child sub tickets",
  "guide-refine-ticket": "guide refine research format ticket",
  "guide-create-extension": "guide custom workflow extension build validate",
  "cli-reference": "cli reference install getting started commands",
  "cli-projects": "cli projects create link repos",
  "cli-workspaces": "cli workspaces worktree merge parallel",
  "cli-agents": "cli agents harness setup install skills",
  "cli-sessions": "cli sessions prompt stream follow up approve lifecycle",
  "cli-extensions": "cli extensions serve close logs install",
  "cli-planner": "cli planner extension tickets templates statuses tags",
  "cli-configuration": "cli configuration config json agents env",
  "sdk-reference": "sdk reference entry points install",
  "sdk-commands": "sdk extension commands defineExtension params middleware",
  "sdk-views": "sdk views renderers webview tree file data",
  "sdk-hooks": "sdk hooks schedules events cron lifecycle",
  "sdk-client": "sdk client http api types prompts",
  "sdk-assets": "sdk assets templates skills themes packageAsset",
  blog: "blog posts news announcements",
  privacy: "privacy policy legal data",
  terms: "terms of service legal",
};

interface CommandPaletteModalProps {
  open: boolean;
  sidebarAvailable: boolean;
  onClose: () => void;
  onNavigate: (view: LandingView) => void;
  onSelectTab: (tab: ProjectTabId) => void;
  onOpenChangelog: () => void;
  onToggleSidebar: () => void;
}

export const CommandPaletteModal = (props: CommandPaletteModalProps) => {
  const { open, sidebarAvailable, onClose, onNavigate, onSelectTab, onOpenChangelog, onToggleSidebar } = props;

  const { toggleThemePreference } = useThemePreference();

  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  const viewEntries: PaletteEntry[] = (Object.keys(VIEW_META) as LandingView[]).map((view) => {
    const meta = VIEW_META[view];
    return {
      id: `nav:${view}`,
      label: meta.label,
      searchText: VIEW_SEARCH_TEXT[view],
      group: "Navigate",
      icon: <meta.icon size={14} />,
      onActivate: run(() => onNavigate(view)),
    };
  });

  const projectEntries: PaletteEntry[] = PROJECT_TABS.map((tab) => ({
    id: `project:${tab.id}`,
    label: tab.label,
    searchText: `project tab ${tab.label}`,
    group: "Projects",
    icon: <tab.icon size={14} />,
    onActivate: run(() => onSelectTab(tab.id)),
  }));

  const externalEntries: PaletteEntry[] = [
    {
      id: "ext:github",
      label: "GitHub",
      searchText: "github source repository code",
      icon: <Github size={14} />,
      url: SITE_LINKS.github,
    },
    {
      id: "ext:discord",
      label: "Discord",
      searchText: "discord community chat help",
      icon: <MessagesSquare size={14} />,
      url: SITE_LINKS.discord,
    },
  ].map(({ url, ...entry }) => ({
    ...entry,
    group: "Navigate",
    endContent: <ArrowUpRight size={12} />,
    onActivate: run(() => window.open(url, "_blank", "noopener")),
  }));

  const commandEntries: PaletteEntry[] = [
    {
      id: "command:copy-install",
      label: "Copy install command",
      searchText: "copy install command bun pstdio",
      group: "Commands",
      icon: <Copy size={14} />,
      onActivate: run(() => navigator.clipboard.writeText(INSTALL_COMMANDS.join("\n"))),
    },
    {
      id: "command:changelog",
      label: "View changelog",
      searchText: "changelog releases versions what's new",
      group: "Commands",
      icon: <GitBranch size={14} />,
      onActivate: run(onOpenChangelog),
    },
    ...(sidebarAvailable
      ? [
          {
            id: "command:toggle-sidebar",
            label: "Toggle sidebar",
            searchText: "toggle sidebar panel hide show",
            group: "Commands",
            icon: <PanelLeft size={14} />,
            onActivate: run(onToggleSidebar),
          } satisfies PaletteEntry,
        ]
      : []),
    {
      id: "command:toggle-theme",
      label: "Toggle light/dark theme",
      searchText: "toggle theme light dark mode appearance",
      group: "Commands",
      icon: <SunMoon size={14} />,
      onActivate: run(toggleThemePreference),
    },
  ];

  return (
    <Palette
      open={open}
      entries={[...projectEntries, ...viewEntries, ...externalEntries, ...commandEntries]}
      placeholder="Search or run a command…"
      onClose={onClose}
    />
  );
};
