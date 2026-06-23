import { normalizeHotkey } from "@tanstack/hotkeys";

export type ReservedKeybindingPlatform = "mac" | "linux" | "win";

export type ReservedKeybindingReason =
  | "browser_close_tab"
  | "browser_devtools"
  | "browser_downloads"
  | "browser_find"
  | "browser_focus_address_bar"
  | "browser_fullscreen"
  | "browser_history_or_hide"
  | "browser_new_tab"
  | "browser_new_window"
  | "browser_print"
  | "browser_private_window"
  | "browser_quit"
  | "browser_refresh"
  | "browser_reopen_tab"
  | "browser_save"
  | "browser_tab_navigation"
  | "browser_view_source"
  | "browser_zoom"
  | "os_terminal"
  | "os_window_navigation";

interface ReservedKeybindingEntry {
  chord: string;
  reason: ReservedKeybindingReason;
  description: string;
  platforms?: readonly ReservedKeybindingPlatform[];
}

const TANSTACK_PLATFORMS: Record<ReservedKeybindingPlatform, "mac" | "linux" | "windows"> = {
  linux: "linux",
  mac: "mac",
  win: "windows",
};

const ALL_PLATFORMS: readonly ReservedKeybindingPlatform[] = ["mac", "linux", "win"];

// Common chords claimed by browsers, OSes, and developer tooling. Built-in
// shortcuts must avoid these and extensions get a warning when they reuse one.
const RESERVED_ENTRIES: readonly ReservedKeybindingEntry[] = [
  { chord: "Mod+T", reason: "browser_new_tab", description: "Open new browser tab" },
  { chord: "Mod+N", reason: "browser_new_window", description: "Open new browser window" },
  { chord: "Mod+W", reason: "browser_close_tab", description: "Close browser tab" },
  { chord: "Mod+R", reason: "browser_refresh", description: "Reload browser tab" },
  { chord: "F5", reason: "browser_refresh", description: "Reload browser tab" },
  { chord: "Mod+P", reason: "browser_print", description: "Print page" },
  { chord: "Mod+S", reason: "browser_save", description: "Save page" },
  { chord: "Mod+F", reason: "browser_find", description: "Find in page" },
  { chord: "Mod+J", reason: "browser_downloads", description: "Open browser downloads", platforms: ["linux", "win"] },
  { chord: "Mod+L", reason: "browser_focus_address_bar", description: "Focus the browser address bar" },
  { chord: "Mod+Q", reason: "browser_quit", description: "Quit the browser/application" },
  {
    chord: "Mod+Alt+ArrowLeft",
    reason: "os_window_navigation",
    description: "Navigate OS spaces or browser tabs",
    platforms: ["mac", "linux"],
  },
  {
    chord: "Mod+Alt+ArrowRight",
    reason: "os_window_navigation",
    description: "Navigate OS spaces or browser tabs",
    platforms: ["mac", "linux"],
  },
  {
    chord: "Mod+Alt+ArrowLeft",
    reason: "browser_tab_navigation",
    description: "Navigate browser tabs",
    platforms: ["win"],
  },
  {
    chord: "Mod+Alt+ArrowRight",
    reason: "browser_tab_navigation",
    description: "Navigate browser tabs",
    platforms: ["win"],
  },
  { chord: "Mod+Shift+T", reason: "browser_reopen_tab", description: "Reopen last closed tab" },
  { chord: "Mod+Shift+N", reason: "browser_private_window", description: "Open a private/incognito window" },
  {
    chord: "Mod+Shift+P",
    reason: "browser_private_window",
    description: "Open a private window or DevTools command menu",
  },
  { chord: "Mod+Shift+R", reason: "browser_refresh", description: "Hard reload" },
  { chord: "Mod+Shift+I", reason: "browser_devtools", description: "Open browser developer tools" },
  { chord: "Mod+Shift+J", reason: "browser_devtools", description: "Open browser developer tools console" },
  {
    chord: "Mod+Shift+K",
    reason: "browser_devtools",
    description: "Open Firefox developer tools console",
    platforms: ["linux", "win"],
  },
  { chord: "Mod+Shift+C", reason: "browser_devtools", description: "Open browser inspect-element tool" },
  { chord: "F12", reason: "browser_devtools", description: "Open browser developer tools" },
  { chord: "Ctrl+Alt+T", reason: "os_terminal", description: "Open the Linux terminal", platforms: ["linux"] },
  { chord: "Mod+U", reason: "browser_view_source", description: "View page source", platforms: ["linux", "win"] },
  { chord: "F11", reason: "browser_fullscreen", description: "Toggle browser fullscreen", platforms: ["linux", "win"] },
  { chord: "Mod+H", reason: "browser_history_or_hide", description: "Browser history or hide application window" },
  { chord: "Mod+0", reason: "browser_zoom", description: "Reset browser zoom" },
  { chord: "Mod+Plus", reason: "browser_zoom", description: "Zoom in" },
  { chord: "Mod+-", reason: "browser_zoom", description: "Zoom out" },
  { chord: "Mod+=", reason: "browser_zoom", description: "Zoom in" },
];

export interface ReservedKeybindingMatch {
  platform: ReservedKeybindingPlatform;
  chord: string;
  canonicalChord: string;
  reason: ReservedKeybindingReason;
  description: string;
}

const canonicalize = (chord: string, platform: ReservedKeybindingPlatform) =>
  normalizeHotkey(chord, TANSTACK_PLATFORMS[platform]);

const buildReservedIndex = () => {
  const byPlatform = new Map<ReservedKeybindingPlatform, Map<string, ReservedKeybindingEntry>>();
  for (const platform of ALL_PLATFORMS) byPlatform.set(platform, new Map());

  for (const entry of RESERVED_ENTRIES) {
    const platforms = entry.platforms ?? ALL_PLATFORMS;
    for (const platform of platforms) {
      const canonical = canonicalize(entry.chord, platform);
      byPlatform.get(platform)?.set(canonical, entry);
    }
  }

  return byPlatform;
};

const reservedIndex = buildReservedIndex();

export const findReservedKeybindingConflict = (
  chord: string,
  platform: ReservedKeybindingPlatform,
): ReservedKeybindingMatch | undefined => {
  const canonical = canonicalize(chord, platform);
  const entry = reservedIndex.get(platform)?.get(canonical);
  if (!entry) return undefined;
  return {
    platform,
    chord,
    canonicalChord: canonical,
    reason: entry.reason,
    description: entry.description,
  };
};

export const findReservedKeybindingConflicts = (
  chordsByPlatform: Partial<Record<ReservedKeybindingPlatform, string>>,
): ReservedKeybindingMatch[] => {
  const conflicts: ReservedKeybindingMatch[] = [];
  for (const platform of ALL_PLATFORMS) {
    const chord = chordsByPlatform[platform];
    if (!chord) continue;
    const conflict = findReservedKeybindingConflict(chord, platform);
    if (conflict) conflicts.push(conflict);
  }
  return conflicts;
};

export const findFirstReservedKeybindingConflict = (
  chordsByPlatform: Partial<Record<ReservedKeybindingPlatform, string>>,
): ReservedKeybindingMatch | undefined => findReservedKeybindingConflicts(chordsByPlatform)[0];

export const listReservedKeybindings = (): readonly ReservedKeybindingEntry[] => RESERVED_ENTRIES;
