import { Box, HStack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  KanbanSquare,
  MessageCircle,
  Moon,
  Palette as PaletteIcon,
  Plus,
  Search,
  SettingsIcon,
  Sun,
  Terminal,
} from "lucide-react";
import { useState } from "react";
import { Palette, type PaletteEntry, type PaletteMode } from "./palette";
import { PaletteShortcut } from "./palette-shortcut";

const baseEntries: PaletteEntry[] = [
  {
    id: "nav:tickets",
    mode: "search",
    label: "Tickets",
    searchText: "tickets board backlog kanban",
    icon: <KanbanSquare size={14} />,
    onActivate: () => undefined,
  },
  {
    id: "nav:sessions",
    mode: "search",
    label: "Sessions",
    searchText: "sessions chat agents",
    icon: <MessageCircle size={14} />,
    onActivate: () => undefined,
  },
  {
    id: "nav:settings",
    mode: "search",
    label: "Project settings",
    searchText: "settings project tags statuses repositories agents",
    icon: <SettingsIcon size={14} />,
    onActivate: () => undefined,
  },
  {
    id: "command:create-ticket",
    mode: "command",
    label: "Create ticket",
    searchText: "create ticket new issue",
    icon: <Plus size={14} />,
    onActivate: () => undefined,
  },
  {
    id: "command:change-theme",
    mode: "command",
    label: "Change theme",
    searchText: "theme color appearance preferences",
    shortcut: <PaletteShortcut binding="Alt+Shift+T" />,
    icon: <PaletteIcon size={14} />,
    onActivate: () => undefined,
  },
  {
    id: "ticket:PS-74",
    mode: "search",
    label: "PS-74 Add command palette",
    icon: <KanbanSquare size={14} />,
    onActivate: () => undefined,
  },
  {
    id: "ticket:PS-101",
    mode: "search",
    label: "PS-101 Theme dashboard surfaces",
    icon: <KanbanSquare size={14} />,
    onActivate: () => undefined,
  },
  {
    id: "session:session-1",
    mode: "search",
    label: "Plan project sidebar updates",
    searchText: "session chat agent",
    icon: <MessageCircle size={14} />,
    onActivate: () => undefined,
  },
];

const themeEntries: PaletteEntry[] = [
  {
    id: "theme:pstdio-light",
    mode: "theme",
    label: "Light",
    searchText: "theme color pstdio-light light",
    icon: <Sun size={14} />,
    isSelected: true,
    onActivate: () => undefined,
  },
  {
    id: "theme:pstdio-dark",
    mode: "theme",
    label: "Dark",
    searchText: "theme color pstdio-dark dark",
    icon: <Moon size={14} />,
    onActivate: () => undefined,
  },
  {
    id: "theme:monokai",
    mode: "theme",
    label: "Monokai",
    searchText: "theme color monokai",
    icon: <PaletteIcon size={14} />,
    onActivate: () => undefined,
  },
];

const largeEntries: PaletteEntry[] = [
  ...Array.from({ length: 180 }, (_, index) => ({
    id: `ticket:PS-${index + 200}`,
    mode: "search",
    label: `PS-${index + 200} Virtualized ticket asset ${index + 1}`,
    group: "Tickets",
    assetType: "ticket",
    icon: <KanbanSquare size={14} />,
    onActivate: () => undefined,
  })),
  ...Array.from({ length: 120 }, (_, index) => ({
    id: `session:large-session-${index + 1}`,
    mode: "search",
    label: `Virtualized session asset ${index + 1}`,
    searchText: "session chat agent",
    group: "Sessions",
    assetType: "session",
    icon: <MessageCircle size={14} />,
    onActivate: () => undefined,
  })),
];

const commandResourceModes: PaletteMode[] = [{ id: "search" }, { id: "command", inputPrefix: ">" }];

interface PaletteStoryProps {
  entries?: PaletteEntry[];
  initialQuery?: string;
  initialActiveIndex?: number;
  modes?: PaletteMode[];
  placeholder?: string;
  footerEnd?: string;
}

const PaletteStory = (props: PaletteStoryProps) => {
  const {
    entries = baseEntries,
    initialQuery = "",
    initialActiveIndex = 0,
    modes,
    placeholder = "Search tickets, sessions, commands",
    footerEnd,
  } = props;
  const [open, setOpen] = useState(true);

  return (
    <Box bg="bg" minH="32rem" p="lg">
      <Palette
        open={open}
        entries={entries}
        initialQuery={initialQuery}
        initialActiveIndex={initialActiveIndex}
        modes={modes}
        resetKey={initialQuery}
        inputIcon={({ mode }) => (mode === "command" ? <Terminal size={16} /> : <Search size={16} />)}
        placeholder={({ mode }) => (mode === "command" ? "Run command" : placeholder)}
        emptyLabel="No results."
        footerStart={
          <HStack gap="2" color="fg.muted">
            <Text textStyle="label/XS">Open palette</Text>
            <PaletteShortcut binding="Mod+K" />
          </HStack>
        }
        footerEnd={
          <Text textStyle="label/XS" color="fg.muted">
            {footerEnd ?? "Type to filter results"}
          </Text>
        }
        onClose={() => setOpen(false)}
      />
    </Box>
  );
};

const meta: Meta<typeof PaletteStory> = {
  title: "Components/Overlays/Palette",
  component: PaletteStory,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof PaletteStory>;

export const Default: Story = {
  render: () => <PaletteStory />,
};

export const KeyboardSelection: Story = {
  render: () => <PaletteStory initialActiveIndex={2} />,
};

export const ThemeMenu: Story = {
  render: () => <PaletteStory entries={themeEntries} placeholder="Choose a theme" footerEnd="Preview theme" />,
};

export const Modes: Story = {
  render: () => (
    <PaletteStory
      modes={commandResourceModes}
      initialQuery="> "
      placeholder="Search resources"
      footerEnd="Type > to search commands"
    />
  ),
};

const slideResources = [
  { id: "intro", label: "Introduction" },
  { id: "architecture", label: "Architecture overview" },
  { id: "demo", label: "Live demo" },
  { id: "q-and-a", label: "Q&A" },
];

const buildSlideEntries = (query: string): PaletteEntry[] => {
  const needle = query.trim().toLowerCase();
  return slideResources
    .filter((slide) => !needle || slide.label.toLowerCase().includes(needle))
    .map((slide) => ({
      id: `slide:${slide.id}`,
      label: slide.label,
      searchText: `${query} ${slide.label}`,
      group: "Slides",
      onActivate: () => undefined,
    }));
};

// Demonstrates query-driven entries: `onQueryChange` lets a host re-fetch results
// (e.g. from an extension provider) as the user types, instead of filtering a static list.
const AsyncResultsPaletteStory = () => {
  const [open, setOpen] = useState(true);
  const [entries, setEntries] = useState<PaletteEntry[]>(() => buildSlideEntries(""));

  return (
    <Box bg="bg" minH="32rem" p="lg">
      <Palette
        open={open}
        entries={entries}
        resetKey="async"
        inputIcon={() => <Search size={16} />}
        placeholder="Search slides (results fetched per query)"
        emptyLabel="No slides match."
        footerEnd={
          <Text textStyle="label/XS" color="fg.muted">
            Results update as you type
          </Text>
        }
        onQueryChange={(query) => setEntries(buildSlideEntries(query))}
        onClose={() => setOpen(false)}
      />
    </Box>
  );
};

export const AsyncResults: Story = {
  render: () => <AsyncResultsPaletteStory />,
};

export const LargeAssetSet: Story = {
  render: () => <PaletteStory entries={largeEntries} />,
};
