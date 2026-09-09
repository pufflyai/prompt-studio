import { Palette, type PaletteEntry, useThemePreference } from "@pstdio/ui";
import { ArrowUpRight, CircleDot, Download, Github, MessagesSquare, SunMoon } from "lucide-react";
import { type LandingView, SIDEBAR_VIEWS, SITE_LINKS, VIEW_META } from "../../content/landing-content";
import { DESKTOP_RELEASES_URL } from "../../services/desktop-releases";

const VIEW_SEARCH_TEXT: Record<LandingView, string> = {
  start: "home landing start here install",
  "why-prompt-studio": "why prompt studio plumbing extensions reasons mission",
  examples: "examples tools icons coding agent dashboard kanban financial formula glossary building blocks",
  features: "features search notifications navigation extension management themes plumbing",
  privacy: "privacy policy legal data",
  terms: "terms of service legal",
};

interface CommandPaletteModalProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: LandingView) => void;
}

export const CommandPaletteModal = (props: CommandPaletteModalProps) => {
  const { open, onClose, onNavigate } = props;
  const { toggleThemePreference } = useThemePreference();

  const run = (action: () => void) => () => {
    onClose();
    action();
  };

  const viewEntries: PaletteEntry[] = SIDEBAR_VIEWS.map((view) => {
    const Icon = VIEW_META[view].icon;

    return {
      id: `nav:${view}`,
      label: VIEW_META[view].label,
      searchText: VIEW_SEARCH_TEXT[view],
      group: "Navigate",
      icon: <Icon size={14} />,
      onActivate: run(() => onNavigate(view)),
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
      entries={[...viewEntries, ...externalEntries, ...commandEntries]}
      placeholder="Search or run a command…"
      onClose={onClose}
    />
  );
};
