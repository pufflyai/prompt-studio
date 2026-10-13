import type { PageRef, ResourceRef } from "@pstdio/sdk/extensions";
import type { SessionMessage } from "@pstdio/ui/chat-ui";
import { createShowcaseStore } from "../showcases/showcase-store";

export const dashboardExtensionId = "storybook.dashboard";
export const dashboardPages = {
  workspaces: { kind: "page", extensionId: dashboardExtensionId, id: "workspaces" },
  workspace: { kind: "page", extensionId: dashboardExtensionId, id: "workspace" },
  notes: { kind: "page", extensionId: dashboardExtensionId, id: "notes" },
  note: { kind: "page", extensionId: dashboardExtensionId, id: "note" },
} as const satisfies Record<string, PageRef>;

export const dashboardWorkspaces = [
  {
    type: "demo.workspace",
    id: "website",
    label: "Website",
    metadata: { workspaceId: "website", workspacePath: "/projects/website" },
  },
  {
    type: "demo.workspace",
    id: "design-system",
    label: "Design system",
    metadata: { workspaceId: "design-system", workspacePath: "/projects/design-system" },
  },
] satisfies ResourceRef[];
export const dashboardNote: ResourceRef = { type: "demo.note", id: "checklist", label: "Launch checklist" };
export const dashboardSessions = dashboardWorkspaces.map((workspace) => ({
  type: "demo.session",
  id: workspace.id,
  label: workspace.id === "website" ? "Review homepage" : "Review components",
  metadata: { workspaceId: workspace.id, workspaceLabel: workspace.label },
}));
export const dashboardFilePaths = ["README.md", "src/app.ts", "package.json"];
export const dashboardFileResource = (workspace: ResourceRef, path: string): ResourceRef => ({
  ...workspace,
  metadata: { ...workspace.metadata, workspaceView: "files", workspaceFilePath: path },
});

export const createDashboardData = () => {
  const files = new Map<string, string>();
  for (const workspace of dashboardWorkspaces) {
    files.set(
      `${workspace.id}/README.md`,
      `# ${workspace.label}\n\nA small project you can explore and edit.\n\n## Try the workbench\n\n- Select another file in the sidebar.\n- Open **Changes** to review the project.\n- Open a conversation and send a sample message.\n- Drag a tab into another panel, then switch workspaces.\n\nYour edits and conversations stay in this demo until you refresh the browser.\n`,
    );
    files.set(
      `${workspace.id}/src/app.ts`,
      `export const project = "${workspace.label}";\n\nexport function greeting(name: string) {\n  return \`Hello, \${name}!\`;\n}\n`,
    );
    files.set(
      `${workspace.id}/package.json`,
      JSON.stringify({ name: workspace.id, scripts: { dev: "bun src/app.ts" } }, null, 2),
    );
  }
  files.set(
    "checklist",
    "# Launch checklist\n\n- [ ] Review the homepage\n- [ ] Check keyboard navigation\n- [ ] Share the preview\n",
  );
  const conversations: Record<string, SessionMessage[]> = {};
  for (const session of dashboardSessions) {
    conversations[session.id] = [
      {
        id: `${session.id}-user`,
        role: "user",
        parts: [{ type: "text", text: `Help me review ${session.metadata.workspaceLabel}.` }],
      },
      {
        id: `${session.id}-assistant`,
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Start with README.md, then open src/app.ts. You can keep this conversation open while switching files or workspaces. This is a sample conversation; no agent is running.",
          },
        ],
      },
    ];
  }
  return { files, conversations: createShowcaseStore({ messages: conversations }) };
};
export type DashboardData = ReturnType<typeof createDashboardData>;

export const dashboardFileIdentity = (resource: ResourceRef) => {
  if (resource.type === "demo.note") return { key: resource.id, path: "Launch checklist.md" };
  if (resource.type === "demo.workspace") {
    const path = String(resource.metadata?.workspaceFilePath ?? "README.md");
    return { key: `${resource.id}/${path}`, path };
  }
  return { key: resource.id, path: String(resource.metadata?.path) };
};
