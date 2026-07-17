import type { TreeViewSection } from "@pstdio/workbench/core";
import { createDashboardSessions, type DashboardSession } from "./data/dashboard-sessions";
import { buildSessionGroupChildren } from "./session-tree-nodes";

interface BuildSessionsSidebarSectionsInput {
  sessions: DashboardSession[];
}

interface CreateSessionsSidebarSectionsInput extends Omit<BuildSessionsSidebarSectionsInput, "sessions"> {
  projectId?: string;
}

export const buildSessionsSidebarSections = (input: BuildSessionsSidebarSectionsInput): TreeViewSection[] => {
  return [
    {
      id: "sessions-wrap",
      nodes: [
        {
          id: "sessions",
          label: "Sessions",
          collapsible: true,
          children: buildSessionGroupChildren(input.sessions, "resource"),
        },
      ],
    },
  ];
};

export const createSessionsSidebarSections = (input: CreateSessionsSidebarSectionsInput): TreeViewSection[] =>
  buildSessionsSidebarSections({
    ...input,
    sessions: createDashboardSessions(input.projectId),
  });
