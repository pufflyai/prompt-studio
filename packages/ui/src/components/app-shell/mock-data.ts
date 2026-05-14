import type { Diff } from "../diff-viewer/diff-card";
import type { WorkspaceTagDefinition, WorkspaceTicket } from "../tickets/types";

export interface MockProject {
  id: string;
  name: string;
  repoPath: string;
  description: string;
}

export interface MockSession {
  id: string;
  title: string;
  preview: string;
  status: "in_progress" | "awaiting_input" | "completed" | "failed";
  updatedAt: string;
}

export const mockProjects: MockProject[] = [
  {
    id: "alpha",
    name: "Prompt Studio",
    repoPath: "~/code/prompt-studio",
    description: "Main monorepo — dashboard, SDK, and packaged plugins.",
  },
  {
    id: "beta",
    name: "Acme Internal",
    repoPath: "~/code/acme-internal",
    description: "Internal tools for the operations team.",
  },
  {
    id: "gamma",
    name: "Playground",
    repoPath: "~/code/playground",
    description: "Sandbox for prototypes and demos.",
  },
];

export const mockTagDefinitions: WorkspaceTagDefinition[] = [
  {
    name: "component",
    label: "Component",
    options: [
      { value: "ui", label: "UI", color: "purple", icon: "sparkles" },
      { value: "api", label: "API", color: "blue", icon: "wrench" },
      { value: "docs", label: "Docs", color: "cyan", icon: "book-open" },
    ],
  },
  {
    name: "priority",
    label: "Priority",
    options: [
      { value: "high", label: "High", color: "red", icon: "alert-triangle" },
      { value: "medium", label: "Medium", color: "yellow", icon: "alert-triangle" },
      { value: "low", label: "Low", color: "green", icon: "flag" },
    ],
  },
];

export const mockTickets: WorkspaceTicket[] = [
  {
    id: "t1",
    ticketId: "PS-101",
    title: "Add app shell story to UI package",
    status: "in_progress",
    statusColor: "blue",
    assignee: "Jordan",
    tags: [
      { name: "component", value: "ui" },
      { name: "priority", value: "high" },
    ],
    updatedAt: "2026-04-30T09:30:00.000Z",
  },
  {
    id: "t2",
    ticketId: "PS-102",
    title: "Wire command bar shortcut",
    status: "todo",
    statusColor: "gray",
    assignee: "Sam",
    tags: [
      { name: "component", value: "ui" },
      { name: "priority", value: "medium" },
    ],
    updatedAt: "2026-04-29T16:10:00.000Z",
  },
  {
    id: "t3",
    ticketId: "PS-103",
    title: "Document plugin lifecycle hooks",
    status: "todo",
    statusColor: "gray",
    assignee: "Taylor",
    tags: [{ name: "component", value: "docs" }],
    updatedAt: "2026-04-28T08:00:00.000Z",
  },
  {
    id: "t4",
    ticketId: "PS-104",
    title: "Fix workspace diff loading state",
    status: "in_progress",
    statusColor: "blue",
    assignee: "Jordan",
    tags: [
      { name: "component", value: "api" },
      { name: "priority", value: "high" },
    ],
    updatedAt: "2026-04-30T11:00:00.000Z",
  },
  {
    id: "t5",
    ticketId: "PS-105",
    title: "Tighten ticket sidebar selection model",
    status: "done",
    statusColor: "green",
    assignee: "Jordan",
    tags: [
      { name: "component", value: "ui" },
      { name: "priority", value: "low" },
    ],
    updatedAt: "2026-04-27T13:45:00.000Z",
  },
  {
    id: "t6",
    ticketId: "PS-106",
    title: "Add changeset linter to CI",
    status: "done",
    statusColor: "green",
    assignee: "Sam",
    tags: [{ name: "component", value: "api" }],
    updatedAt: "2026-04-26T17:20:00.000Z",
  },
];

export const mockTicketDescription = `## Goal

Mirror the dashboard surface inside Storybook so design and engineering can review whole-page composition without booting the app.

## Notes

- Use mock data only — no async loading.
- Sidebar navigation should switch between pages.
- All pages share the same shell.`;

export const mockSessions: MockSession[] = [
  {
    id: "s1",
    title: "Refactor command palette",
    preview: "Wired the keyboard shortcut and confirmed it opens reliably.",
    status: "in_progress",
    updatedAt: "2026-04-30T10:15:00.000Z",
  },
  {
    id: "s2",
    title: "Investigate workspace diff regression",
    preview: "Reproduced on stale attempts; needs a follow-up fix.",
    status: "awaiting_input",
    updatedAt: "2026-04-29T18:42:00.000Z",
  },
  {
    id: "s3",
    title: "Generate changelog for 0.5.0",
    preview: "Draft published — awaiting review from the release captain.",
    status: "completed",
    updatedAt: "2026-04-29T09:05:00.000Z",
  },
  {
    id: "s4",
    title: "Triage failing e2e suite",
    preview: "Three flakes traced to network mock teardown order.",
    status: "failed",
    updatedAt: "2026-04-28T22:11:00.000Z",
  },
];

export interface MockWorkspace {
  id: string;
  shorthand: string;
  ticketId: string;
  branch: string;
  status: "in_progress" | "completed" | "failed";
}

export const mockWorkspaces: MockWorkspace[] = [
  {
    id: "w1",
    shorthand: "A1",
    ticketId: "t1",
    branch: "feature/app-shell-story",
    status: "in_progress",
  },
];

export const mockDiffs: Diff[] = [
  {
    change: "modified",
    oldPath: "packages/ui/src/components/app-shell/app-shell.tsx",
    newPath: "packages/ui/src/components/app-shell/app-shell.tsx",
    additions: 18,
    deletions: 4,
    oldContent: `import { useState } from "react";

export const AppShell = () => {
  const [view, setView] = useState({ name: "project-list" });
  return null;
};
`,
    newContent: `import { useEffect, useState } from "react";

import { CommandPalette } from "./command-palette";

export const AppShell = () => {
  const [view, setView] = useState({ name: "project-list" });
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />;
};
`,
  },
  {
    change: "added",
    newPath: "packages/ui/src/components/app-shell/command-palette.tsx",
    additions: 96,
    deletions: 0,
    newContent: `import { Dialog } from "@chakra-ui/react";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export const CommandPalette = (props: CommandPaletteProps) => {
  return (
    <Dialog.Root open={props.open} onOpenChange={(details) => !details.open && props.onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content />
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
`,
  },
  {
    change: "modified",
    oldPath: "packages/ui/src/components/tickets/tickets-workspace.tsx",
    newPath: "packages/ui/src/components/tickets/tickets-workspace.tsx",
    additions: 4,
    deletions: 1,
    oldContent: `interface TicketsWorkspaceProps {
  tickets: WorkspaceTicket[];
  storageKey: string;
}
`,
    newContent: `interface TicketsWorkspaceProps {
  tickets: WorkspaceTicket[];
  storageKey: string;
  hideToolbar?: boolean;
}
`,
  },
  {
    change: "deleted",
    oldPath: "packages/ui/src/components/style-guide-components-page.tsx",
    additions: 0,
    deletions: 240,
    oldContent: "// Replaced by app-shell story\n",
  },
];

export interface MockCheck {
  id: string;
  name: string;
  status: "passed" | "failed" | "running";
  duration: string;
  details: string;
}

export const mockChecks: MockCheck[] = [
  { id: "c1", name: "lint", status: "passed", duration: "11s", details: "biome check ." },
  { id: "c2", name: "typecheck", status: "passed", duration: "23s", details: "tsc --noEmit" },
  { id: "c3", name: "unit tests", status: "passed", duration: "1m 04s", details: "100 pass, 0 fail" },
  { id: "c4", name: "e2e tests", status: "running", duration: "—", details: "starting browser…" },
];
