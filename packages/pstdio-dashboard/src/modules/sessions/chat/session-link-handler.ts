import {
  defaultPageResourceCodec,
  parseWorkbenchPageUrl,
  serializeWorkbenchPageUrl,
  workbenchPages,
} from "@pstdio/sdk/extensions";
import { type ChatLinkCandidate, type ChatLinkHandler, parseChatLink } from "@pstdio/ui/chat-ui";
import type { WorkbenchCore } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { openProjectPageUrl } from "@/shared/workbench/open-project-page-url";
import { workspaceFileResource } from "@/shared/workspaces/workspace-file-resource";
import { workspaceLinkPath } from "@/shared/workspaces/workspace-link-path";
import {
  createDashboardWorkspaceOptionResource,
  createDashboardWorkspaceOptions,
} from "@/shared/workspaces/workspace-options";

interface SessionLinkHandlerInput {
  workbench: WorkbenchCore;
  projectId?: string;
  workspaceId?: string | null;
  origin: string;
  onError(message: string): void;
}

const resolveWorkspaceFile = (
  input: SessionLinkHandlerInput,
  parsed: Extract<ReturnType<typeof parseChatLink>, { kind: "file" }>,
  pages: ReturnType<WorkbenchCore["pages"]["listPages"]>,
  resources: typeof defaultPageResourceCodec,
) => {
  if (!input.workspaceId) throw new Error("The conversation has no workspace.");
  const workspace = createDashboardWorkspaceOptions(input.projectId).find(
    (workspace) => workspace.id === input.workspaceId,
  );
  if (!workspace) throw new Error("The conversation workspace is unavailable.");
  if (workspace.executionKind !== "local") throw new Error("Remote workspace files are unavailable.");
  if (!workspace.supportsFiles) throw new Error("This workspace does not support files.");
  const path = workspaceLinkPath(parsed.path, workspace.workspacePath);
  const resource = workspaceFileResource(createDashboardWorkspaceOptionResource(workspace, input.projectId), path);
  const target = { kind: "page" as const, page: workbenchPages.workspace, resource, position: parsed.position };
  return {
    kind: "page" as const,
    target,
    href: serializeWorkbenchPageUrl({ projectId: input.projectId!, location: target, pages, resources }),
  };
};

export const createSessionLinkHandler = (input: SessionLinkHandlerInput): ChatLinkHandler => {
  const resolve = (candidate: ChatLinkCandidate) => {
    const parsed = parseChatLink(candidate, input.origin);
    if (!parsed) throw new Error("This text is not a file link.");
    if (parsed.kind === "invalid") throw new Error(parsed.reason);
    if (!input.projectId) throw new Error("The conversation has no project.");
    const pages = input.workbench.pages.listPages();
    const resources = defaultPageResourceCodec;
    if (parsed.kind === "page" || parsed.kind === "external") {
      const url = new URL(parsed.href, input.origin);
      if (url.origin !== input.origin || !url.pathname.startsWith("/projects/")) return undefined;
      const projectId = decodeURIComponent(url.pathname.split("/")[2] ?? "");
      if (projectId !== input.projectId)
        return { kind: "project" as const, projectId, href: url.pathname + url.search };
      const destination = parseWorkbenchPageUrl({
        url: url.pathname + url.search,
        projectId: input.projectId,
        pages,
        resources,
      });
      if (!destination) throw new Error("This page or document link is unavailable in the conversation project.");
      const page = pages.find((page) => page.id === destination.pageId)!;
      const target = {
        kind: "page" as const,
        page: page.ref,
        resource: destination.resource,
        section: destination.section,
        position: destination.position,
      };
      return {
        kind: "page" as const,
        target,
        href: serializeWorkbenchPageUrl({ projectId: input.projectId, location: target, pages, resources }),
      };
    }
    return resolveWorkspaceFile(input, parsed, pages, resources);
  };
  return {
    describe(candidate) {
      const workspace = createDashboardWorkspaceOptions(input.projectId).find(
        (workspace) => workspace.id === input.workspaceId,
      );
      return `Open ${candidate.source}${workspace ? ` in workspace ${workspace.title}` : ""}`;
    },
    resolveHref(candidate) {
      try {
        return resolve(candidate)?.href ?? null;
      } catch {
        return null;
      }
    },
    async open(candidate) {
      try {
        if (getDashboardSelectedProjectId(input.workbench) !== input.projectId) return;
        const destination = resolve(candidate);
        if (!destination) return;
        if (destination.kind === "project") {
          await openProjectPageUrl({
            workbench: input.workbench,
            href: destination.href,
            projectId: destination.projectId,
            sourceProjectId: input.projectId!,
          });
          return;
        }
        const result = input.workbench.pageLocations.navigate(destination.target);
        if (!result.ok) throw new Error(result.diagnostic.message);
      } catch (error) {
        input.onError(`${candidate.source}: ${error instanceof Error ? error.message : "Could not open this link."}`);
      }
    },
  };
};
