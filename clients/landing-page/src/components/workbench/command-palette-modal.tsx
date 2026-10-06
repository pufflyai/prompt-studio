import { filterPaletteEntries, Palette, type PaletteEntry, useThemePreference } from "@pstdio/ui";
import {
  ArrowUpRight,
  BookOpen,
  CircleDot,
  Download,
  FileText,
  Github,
  MessagesSquare,
  Newspaper,
  SunMoon,
} from "lucide-react";
import { docsTopicForPath } from "../../content/docs-topics";
import { SIDEBAR_VIEWS, SITE_LINKS, type SidebarView, VIEW_META } from "../../content/landing-content";
import type { LandingPage } from "../../content/landing-pages";
import { DESKTOP_RELEASES_URL } from "../../services/desktop-releases";
import { landingPathForView } from "../../services/landing-route";

const VIEW_SEARCH_TEXT: Record<SidebarView, string> = {
  start: "home landing start here install",
  "what-is-prompt-studio": "what is prompt studio extensions tools building blocks workbench",
  examples: "examples tools icons coding agent dashboard kanban financial formula glossary building blocks",
  features: "features search notifications navigation extension management themes plumbing",
};

interface CommandPaletteModalProps {
  open: boolean;
  pages: LandingPage[];
  onClose: () => void;
  onNavigate: (path: string) => void;
}

export const CommandPaletteModal = (props: CommandPaletteModalProps) => {
  const { open, pages, onClose, onNavigate } = props;
  const { toggleThemePreference } = useThemePreference();

  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  const viewEntries: PaletteEntry[] = [
    ...SIDEBAR_VIEWS.map((view) => {
      const Icon = VIEW_META[view].icon;
      return {
        id: `nav:${view}`,
        label: VIEW_META[view].label,
        searchText: VIEW_SEARCH_TEXT[view],
        icon: <Icon size={14} />,
        path: landingPathForView(view),
      };
    }),
    {
      id: "nav:docs",
      label: "Docs",
      searchText: "documentation guides references",
      icon: <BookOpen size={14} />,
      path: "/docs/",
    },
    { id: "nav:blog", label: "Blog", searchText: "news posts releases", icon: <Newspaper size={14} />, path: "/blog/" },
  ].map(({ path, ...entry }) => ({ ...entry, group: "Navigate", onActivate: run(() => onNavigate(path)) }));

  // Pages and posts appear once the visitor types, so the open palette stays short.
  const documentEntries: PaletteEntry[] = pages.flatMap((page) => {
    if (page.view !== "doc" && page.view !== "post") return [];
    const topic = docsTopicForPath(page.path)?.label;
    return {
      id: `page:${page.path}`,
      label: page.label,
      secondaryLabel: topic,
      searchText: topic,
      group: page.view === "doc" ? "Docs" : "Blog",
      assetType: page.view,
      icon: page.view === "doc" ? <FileText size={14} /> : <Newspaper size={14} />,
      onActivate: run(() => onNavigate(page.path)),
    };
  });

  const externalEntries: PaletteEntry[] = [
    {
      id: "ext:github",
      label: "GitHub",
      searchText: "github source repository code",
      icon: <Github size={14} />,
      url: SITE_LINKS.github,
    },
    {
      id: "ext:issues",
      label: "Issues",
      searchText: "issues bugs report",
      icon: <CircleDot size={14} />,
      url: SITE_LINKS.issues,
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
      id: "command:download",
      label: "Download Prompt Studio",
      searchText: "download install desktop macos windows linux",
      group: "Commands",
      icon: <Download size={14} />,
      onActivate: run(() => window.open(DESKTOP_RELEASES_URL, "_blank", "noopener")),
    },
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
      entries={[...viewEntries, ...externalEntries, ...documentEntries, ...commandEntries]}
      filterEntries={(entries, query) => filterPaletteEntries(entries, { query, defaultAssetLimit: 0 })}
      placeholder="Search or run a command…"
      onClose={onClose}
    />
  );
};
