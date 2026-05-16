import type { SessionMessage } from "@pstdio/ui/chat-ui";
import type { MenuPath, ResourceRef } from "../../../core";

export const dashboardHelpMenuPath = ["dashboardWorkbench", "help"] as const satisfies MenuPath;

export const dashboardNavigationTreeViewId = "dashboard-workbench.navigation";
export const dashboardFooterTreeViewId = "dashboard-workbench.footer";
export const dashboardSettingsNavigationTreeViewId = "dashboard-workbench.settings.navigation";

export const dashboardWidgetIds = {
  tickets: "dashboard-workbench.tickets",
  extensionRoute: "dashboard-workbench.extension-route",
  settings: "dashboard-workbench.settings",
  status: "dashboard-workbench.status",
  session: "dashboard-workbench.session",
} as const;

const createResource = (kind: string, id: string, label: string, icon: string) =>
  ({
    kind,
    uri: `dashboard-workbench://${kind}/${id}`,
    id,
    label,
    icon,
  }) satisfies ResourceRef;

export const dashboardResources = {
  tickets: createResource("dashboard-view", "tickets", "Tickets", "KanbanSquare"),
  lab: createResource("extension-route", "lab", "Lab", "FlaskConical"),
  repoHealth: createResource("extension-route", "repo-health", "Repo health", "GitBranch"),
  changelog: createResource("extension-route", "changelog", "Changelog", "Workflow"),
  settings: createResource("project-settings", "settings", "Project settings", "Settings"),
} as const;

export const dashboardSettingsResources = {
  agents: createResource("project-settings", "settings/agents", "Agents", "Bot"),
  repositories: createResource("project-settings", "settings/repositories", "Repositories", "GitBranch"),
  labSettings: createResource("project-settings", "settings/lab", "Lab settings", "FlaskConical"),
  auditLog: createResource("project-settings", "settings/audit-log", "Audit log", "ClipboardList"),
  repoHealth: createResource("project-settings", "settings/repo-health", "Repo health", "GitBranch"),
} as const;

export const dashboardTickets = [
  { id: "PS-201", title: "Add command palette quick actions", status: "in progress" },
  { id: "PS-198", title: "Theme dashboard surfaces", status: "review" },
  { id: "PS-187", title: "Extension settings panels v1", status: "in progress" },
  { id: "PS-174", title: "Cap session selector dropdown", status: "done" },
  { id: "PS-159", title: "Pre-warm bun install cache in CI", status: "done" },
  { id: "PS-142", title: "Validate compiled bun extension toolchain", status: "done" },
].map((ticket) => ({
  ...ticket,
  resource: createResource("ticket", ticket.id, `${ticket.id} ${ticket.title}`, "Ticket"),
}));

export const dashboardMockChatMessages: SessionMessage[] = [
  {
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "Walk me through the failures in the e2e suite." }],
  },
  {
    id: "a1",
    role: "assistant",
    parts: [
      { type: "reasoning", text: "Inspecting the latest run logs and grouping failures by signature." },
      {
        type: "tool",
        tool: "workbench",
        callId: "tool-1",
        actionType: "execute",
        status: "completed",
        state: {
          input: { command: "bun run test:e2e --reporter=list" },
          output:
            "Running 23 tests...\n  PASS tickets > drag and drop (1.2s)\n  FAIL workspaces > diff regenerates (8.4s)\n  FAIL sessions > follow-up ordering (4.1s)\n  FAIL tickets > flaky filter (2.0s)\n2 failed, 1 flaky\n",
        },
      },
      {
        type: "text",
        text: "Two of the failures share a teardown ordering bug; the third is a flaky filter. I have a patch ready. Want me to apply it?",
      },
    ],
  },
  {
    id: "u2",
    role: "user",
    parts: [{ type: "text", text: "Yes, ship the patch and re-run on CI." }],
  },
  {
    id: "a2",
    role: "assistant",
    parts: [
      {
        type: "tool",
        tool: "edit",
        callId: "tool-2",
        actionType: "write",
        status: "completed",
        state: {
          input: { path: "packages/e2e/src/setup/teardown.ts" },
          output: "Updated teardown order to await pending fetches before clearing mocks.",
        },
      },
      { type: "text", text: "Patch applied. CI is running, ETA ~6 minutes." },
    ],
  },
];
