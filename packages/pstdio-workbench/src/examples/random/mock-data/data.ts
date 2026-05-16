import type { ResourceRef } from "../../../core";

export const randomResourceKind = "workbench-mode-item";

export const railWidgetId = "random.rail";

export const notesWidgetIds = {
  top: "notes.top",
  editor: "notes.editor",
  related: "notes.related",
  status: "notes.status",
  helper: "notes.helper",
} as const;

export const musicWidgetIds = {
  top: "music.top",
  player: "music.player",
  queue: "music.queue",
  controls: "music.controls",
  status: "music.status",
} as const;

export const mailWidgetIds = {
  top: "mail.top",
  reader: "mail.reader",
  participants: "mail.participants",
  status: "mail.status",
} as const;

export interface WorkbenchModeSection {
  heading: string;
  lines: string[];
}

export interface WorkbenchModeItem {
  id: string;
  title: string;
  subtitle: string;
  sections: WorkbenchModeSection[];
}

export interface WorkbenchModeFolder {
  id: string;
  label: string;
  icon: string;
  itemIds: string[];
}

export interface WorkbenchModeRelated {
  label: string;
  hint: string;
  icon: string;
}

export interface WorkbenchModeAction {
  id: string;
  label: string;
  icon: string;
}

export interface WorkbenchMode {
  id: string;
  label: string;
  topSubtitle: string;
  topIcon: string;
  statusIcon: string;
  statusText: string;
  helperIcon: string;
  helperTitle: string;
  helperBody: string;
  relatedTitle: string;
  related: WorkbenchModeRelated[];
  actions: WorkbenchModeAction[];
  folders: WorkbenchModeFolder[];
  items: WorkbenchModeItem[];
  defaultItemId: string;
}

const notesMode: WorkbenchMode = {
  id: "notes",
  label: "Notes",
  topSubtitle: "personal",
  topIcon: "NotebookText",
  statusIcon: "CloudCheck",
  statusText: "Synced · 4 notes",
  helperIcon: "Sparkles",
  helperTitle: "Note helper",
  helperBody: "Ask me to summarize this note or draft the next section.",
  relatedTitle: "Linked notes",
  related: [
    { label: "Sintra packing list", hint: "linked from Day 2", icon: "Link" },
    { label: "Restaurants in Lisbon", hint: "linked from Day 1", icon: "Link" },
  ],
  actions: [
    { id: "notes.star", label: "Star", icon: "Star" },
    { id: "notes.share", label: "Share", icon: "Share2" },
  ],
  folders: [
    { id: "notes.notebook.personal", label: "Personal", icon: "Folder", itemIds: ["trip-planning", "weekend-prep"] },
    { id: "notes.notebook.work", label: "Work", icon: "Folder", itemIds: ["workbench-demo-notes"] },
    { id: "notes.notebook.reading", label: "Reading", icon: "Folder", itemIds: ["reading-list"] },
  ],
  defaultItemId: "trip-planning",
  items: [
    {
      id: "trip-planning",
      title: "Trip planning",
      subtitle: "Edited 9:30",
      sections: [
        {
          heading: "Day 1 — Arrival",
          lines: ["Land 11:20, taxi to hotel", "Walk Alfama before sunset", "Dinner at Taberna da Rua"],
        },
        {
          heading: "Day 2 — Sintra",
          lines: ["Train at 9:00", "Pena Palace tickets booked", "Back by 18:00 for fado"],
        },
        {
          heading: "Day 3 — Easy day",
          lines: ["Coffee at Fabrica", "LX Factory in the afternoon", "Pack camera, charge batteries"],
        },
      ],
    },
    {
      id: "workbench-demo-notes",
      title: "Workbench demo notes",
      subtitle: "Edited yesterday",
      sections: [
        {
          heading: "Outline",
          lines: [
            "Open with the top bar and rail",
            "Show how main + main-right share state",
            "End on the floating helper",
          ],
        },
        {
          heading: "Talking points",
          lines: [
            "One renderer per widget",
            "Resources drive what the editor shows",
            "The rail switches whole datasets",
          ],
        },
      ],
    },
    {
      id: "reading-list",
      title: "Reading list",
      subtitle: "Edited Mon",
      sections: [
        { heading: "Fiction", lines: ["Piranesi — Susanna Clarke", "The Employees — Olga Ravn"] },
        { heading: "Non-fiction", lines: ["A Pattern Language", "Working in Public"] },
      ],
    },
    {
      id: "weekend-prep",
      title: "Weekend prep",
      subtitle: "Edited Fri",
      sections: [
        { heading: "Groceries", lines: ["Bread, eggs, coffee", "Tomatoes for the sauce"] },
        { heading: "Errands", lines: ["Pick up dry cleaning", "Drop package at post"] },
      ],
    },
  ],
};

const mailMode: WorkbenchMode = {
  id: "mail",
  label: "Mail",
  topSubtitle: "acme.co",
  topIcon: "Mail",
  statusIcon: "Wifi",
  statusText: "Online · 142 unread",
  helperIcon: "PenLine",
  helperTitle: "Draft helper",
  helperBody: "Ask me to draft a reply or summarize the thread.",
  relatedTitle: "Participants",
  related: [
    { label: "Mira Patel", hint: "Engineering", icon: "User" },
    { label: "Jules Okafor", hint: "Engineering", icon: "User" },
    { label: "Ari Nilsson", hint: "Design", icon: "User" },
  ],
  actions: [
    { id: "mail.reply", label: "Reply", icon: "Reply" },
    { id: "mail.archive", label: "Archive", icon: "Archive" },
  ],
  folders: [
    { id: "mail.folder.inbox", label: "Inbox", icon: "Inbox", itemIds: ["thread-workbench-demo", "thread-builds"] },
    { id: "mail.folder.starred", label: "Starred", icon: "Star", itemIds: ["thread-builds"] },
    { id: "mail.folder.drafts", label: "Drafts", icon: "FileEdit", itemIds: ["thread-draft-reply"] },
  ],
  defaultItemId: "thread-workbench-demo",
  items: [
    {
      id: "thread-workbench-demo",
      title: "Re: workbench demo polish",
      subtitle: "Mira · 9:42",
      sections: [
        {
          heading: "Mira Patel — 9:42",
          lines: [
            "Hey — wired up the workbench renderers across the three modes.",
            "The rail switches the whole dataset, which is exactly what we wanted.",
            "Worth a look before the demo this afternoon.",
          ],
        },
        {
          heading: "You — 8:55",
          lines: ["Yes please, I'll review after standup.", "Let's keep the floating helper too, it grounds the demo."],
        },
      ],
    },
    {
      id: "thread-builds",
      title: "Build green ✅",
      subtitle: "Jules · 9:30",
      sections: [
        {
          heading: "Jules Okafor — 9:30",
          lines: ["Bun lockfile is clean and CI is green again.", "Merging the lock bump now."],
        },
      ],
    },
    {
      id: "thread-draft-reply",
      title: "Re: Manifest diff",
      subtitle: "Draft",
      sections: [
        {
          heading: "Draft",
          lines: ["Thanks Ari — I'll fold the diff into the release notes.", "(unsent)"],
        },
      ],
    },
  ],
};

const musicMode: WorkbenchMode = {
  id: "music",
  label: "Music",
  topSubtitle: "my library",
  topIcon: "Music",
  statusIcon: "Headphones",
  statusText: "320 kbps · 18 tracks queued",
  helperIcon: "Sparkle",
  helperTitle: "Mood helper",
  helperBody: "Ask me for a song like this one, or a playlist for tonight.",
  relatedTitle: "Up next",
  related: [
    { label: "After Hours — Maya Hara", hint: "from Drift", icon: "ListMusic" },
    { label: "Slow Bloom — Lila Aoki", hint: "from Open Sky", icon: "ListMusic" },
    { label: "North Light — Kai Holm", hint: "from Field Notes", icon: "ListMusic" },
  ],
  actions: [
    { id: "music.play", label: "Play", icon: "Play" },
    { id: "music.queue", label: "Queue", icon: "ListPlus" },
  ],
  folders: [
    { id: "music.playlist.featured", label: "Playlists", icon: "ListMusic", itemIds: ["lazy-sunday", "focus-flow"] },
    { id: "music.liked", label: "Liked songs", icon: "Heart", itemIds: ["liked-after-hours"] },
  ],
  defaultItemId: "lazy-sunday",
  items: [
    {
      id: "lazy-sunday",
      title: "Lazy Sunday",
      subtitle: "Maya Hara · Drift · 3:42",
      sections: [
        {
          heading: "About",
          lines: ["Single off the 2024 LP Drift.", "Slow-burn jazz with a vinyl crackle layer."],
        },
        {
          heading: "Lyrics",
          lines: ["A late November light", "and the kettle starting again", "we let the morning take its time"],
        },
      ],
    },
    {
      id: "focus-flow",
      title: "Focus flow",
      subtitle: "Playlist · 24 tracks · 1h 38m",
      sections: [
        {
          heading: "Description",
          lines: ["Long-form instrumentals.", "Curated for deep work sessions, low percussion, no vocals."],
        },
      ],
    },
    {
      id: "liked-after-hours",
      title: "After Hours",
      subtitle: "Maya Hara · Drift · 4:01",
      sections: [
        {
          heading: "About",
          lines: ["Companion piece to Lazy Sunday.", "Builds slowly, drops out at 2:48."],
        },
      ],
    },
  ],
};

export const randomWorkbenchModes: Record<string, WorkbenchMode> = {
  notes: notesMode,
  mail: mailMode,
  music: musicMode,
};

export const randomWorkbenchModeOrder = ["notes", "mail", "music"] as const;
export const defaultRandomWorkbenchModeId = "notes";

export const railEntries = randomWorkbenchModeOrder.map((id) => {
  const mode = randomWorkbenchModes[id];
  return { id, label: mode.label, icon: mode.topIcon };
});

export const itemResource = (modeId: string, item: WorkbenchModeItem): ResourceRef => ({
  kind: randomResourceKind,
  id: `${modeId}.${item.id}`,
  uri: `pstdio://workbench-mode/${modeId}/${item.id}`,
  label: item.title,
  icon: "FileText",
  metadata: { modeId, itemId: item.id },
});
