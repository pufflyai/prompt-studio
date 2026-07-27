import { type ResourceRef, standardResourceIcons } from "../../../core";

export type WorkbenchModeId = "project" | "workspace" | "settings";

export interface WorkbenchModeMeta {
  id: WorkbenchModeId;
  label: string;
  description: string;
  icon: string;
}

export const workbenchModeOrder: WorkbenchModeId[] = ["project", "workspace", "settings"];

export const workbenchModes: Record<WorkbenchModeId, WorkbenchModeMeta> = {
  project: {
    id: "project",
    label: "Project",
    description: "Sidenav tree + overview + activity feed",
    icon: standardResourceIcons.project,
  },
  workspace: {
    id: "workspace",
    label: "Workspace",
    description: "File tree + editor + diff preview + terminal",
    icon: standardResourceIcons.workspace,
  },
  settings: {
    id: "settings",
    label: "Settings",
    description: "Focused single-column Main Panel",
    icon: standardResourceIcons.settings,
  },
};

export const activityBarWidgetId = "workbench-modes.activityBar";

export const projectWidgetIds = {
  tree: "workbench-modes.project.tree",
  overview: "workbench-modes.project.overview",
  feed: "workbench-modes.project.feed",
} as const;

export const workspaceWidgetIds = {
  files: "workbench-modes.workspace.files",
  editor: "workbench-modes.workspace.editor",
  diff: "workbench-modes.workspace.diff",
} as const;

export const settingsWidgetIds = {
  page: "workbench-modes.settings.page",
} as const;

export interface ProjectFolder {
  id: string;
  label: string;
  itemIds: string[];
}

export interface ProjectItem {
  id: string;
  label: string;
  status: "open" | "in-progress" | "done";
  body: string;
}

export const projectFolders: ProjectFolder[] = [
  { id: "p.active", label: "Active", itemIds: ["ps-266", "ps-267"] },
  { id: "p.backlog", label: "Backlog", itemIds: ["ps-268", "ps-270"] },
];

export const projectItems: ProjectItem[] = [
  {
    id: "ps-266",
    label: "PS-266 Workbench examples",
    status: "in-progress",
    body: "Stand up the workbench-modes story so each mode shows a different layout.",
  },
  {
    id: "ps-267",
    label: "PS-267 Extension webviews",
    status: "open",
    body: "Render runtime extension webviews inside the workbench host.",
  },
  {
    id: "ps-268",
    label: "PS-268 Registry ownership",
    status: "open",
    body: "Document who owns each registry and how plugins extend them.",
  },
  {
    id: "ps-270",
    label: "PS-270 Activity bar polish",
    status: "open",
    body: "Polish the activity bar styling and add tooltips.",
  },
];

export const projectFeed = [
  { id: "feed.deploy", icon: "Rocket", title: "Deploy succeeded", time: "9:41" },
  { id: "feed.review", icon: "GitPullRequestArrow", title: "Mira opened a review", time: "9:18" },
  { id: "feed.checks", icon: "ListChecks", title: "Checks completed", time: "8:55" },
  { id: "feed.notes", icon: "MessageSquare", title: "New comment on PS-266", time: "8:42" },
];

export interface WorkspaceFile {
  id: string;
  label: string;
  language: string;
  body: string[];
  diff: { added: string[]; removed: string[] };
}

export const workspaceFiles: WorkspaceFile[] = [
  {
    id: "module.tsx",
    label: "module.tsx",
    language: "tsx",
    body: [
      "export const createWorkbenchModes = () => ({",
      "  id: 'workbench-modes',",
      "  activate(ctx) {",
      "    registerActivityBar(ctx);",
      "    registerProjectMode(ctx);",
      "    registerWorkspaceMode(ctx);",
      "    registerSettingsMode(ctx);",
      "    ctx.modes.setActiveMode('project');",
      "  },",
      "});",
    ],
    diff: {
      added: ["+ registerSettingsMode(ctx);", "+ ctx.modes.setActiveMode('project');"],
      removed: ["- ctx.layout.openPanel('legacy.overview');"],
    },
  },
  {
    id: "activity-bar.tsx",
    label: "activity-bar.tsx",
    language: "tsx",
    body: [
      "export const ActivityBar = (props) => (",
      "  <Stack alignItems='center' py='sm' gap='xs'>",
      "    {workbenchModeOrder.map((id) => (",
      "      <ModeButton key={id} mode={workbenchModes[id]} />",
      "    ))}",
      "  </Stack>",
      ");",
    ],
    diff: {
      added: ["+ <ModeButton mode={workbenchModes[id]} />"],
      removed: ["- {railEntries.map(renderEntry)}"],
    },
  },
  {
    id: "settings-mode.tsx",
    label: "settings-mode.tsx",
    language: "tsx",
    body: [
      "export const registerSettingsMode = (ctx) => {",
      "  ctx.modes.registerMode({",
      "    id: 'settings',",
      "    label: 'Settings',",
      "    activate: setupSettingsMode,",
      "  });",
      "};",
    ],
    diff: {
      added: ["+ activate: setupSettingsMode"],
      removed: [],
    },
  },
];

export interface SettingsField {
  id: string;
  label: string;
  hint: string;
  value: string;
}

export const settingsFields: SettingsField[] = [
  { id: "name", label: "Workspace name", hint: "Shown in the activity bar tooltip", value: "Prompt Studio" },
  { id: "default-mode", label: "Default mode", hint: "Mode to activate on workbench load", value: "project" },
  { id: "telemetry", label: "Telemetry", hint: "Anonymous usage signals", value: "Disabled" },
  { id: "theme", label: "Theme", hint: "Workbench color palette", value: "Auto (system)" },
];

export const projectResourceKind = "workbench-modes.project-item";

export const projectItemResource = (item: ProjectItem): ResourceRef => ({
  kind: projectResourceKind,
  uri: `pstdio://workbench-modes/project/${item.id}`,
  id: item.id,
  label: item.label,
  icon: "component",
  metadata: { itemId: item.id },
});

export const workspaceResourceKind = "workbench-modes.workspace-file";

export const workspaceFileResource = (file: WorkspaceFile): ResourceRef => ({
  kind: workspaceResourceKind,
  uri: `pstdio://workbench-modes/workspace/${file.id}`,
  id: file.id,
  label: file.label,
  icon: "FileCode",
  metadata: { fileId: file.id },
});
