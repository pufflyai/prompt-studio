import {
  contributionRefId,
  homePages,
  type PageRef,
  type ResourceRef,
  workbenchPages,
  workspacePages,
} from "@pstdio/sdk/extensions";
import {
  batchWorkbenchChanges,
  type WorkbenchModuleContext,
  type WorkbenchModuleContribution,
} from "@pstdio/workbench";

type PresentationContext = Pick<WorkbenchModuleContext, "pages">;
export const workspacePresentationPath = (resource?: ResourceRef) => {
  if (!resource) return "workspaces";
  if (resource.device || resource.metadata?.workspaceReadOnly === true) return "history";
  if (resource.metadata?.workspaceExecutionKind === "remote" || resource.metadata?.workspaceSupportsFiles === false)
    return "overview";
  if (resource.metadata?.workspaceIsDefault === true || resource.metadata?.workspaceSupportsDiff === false)
    return "files";
  return "workspace";
};

/** Host composition selects the bundled defaults, then stable independently owned project routes. */
export const resolvePresentationPage = (ctx: PresentationContext, path: string) => {
  const pages = ctx.pages.listPages().filter((page) => !page.redirect && page.modeId === "project");
  const preferred = path === "home" ? homePages.home.extensionId : workspacePages.list.extensionId;
  const roots = pages.filter(
    (page) => page.path === (path === "home" ? "home" : "workspaces") && !page.parentId && !page.resource,
  );
  roots.sort(
    (a, b) =>
      Number(b.ref.extensionId === preferred) - Number(a.ref.extensionId === preferred) ||
      contributionRefId(a.ref).localeCompare(contributionRefId(b.ref)),
  );
  const root = roots[0];
  if (!root || path === "home" || path === "workspaces") return root;
  return pages.find(
    (page) =>
      page.path === path &&
      page.parentId === root.id &&
      page.ref.extensionId === root.ref.extensionId &&
      (!["files", "workspace", "history", "overview"].includes(path) ||
        page.resource?.kinds.some(
          (kind) => kind.id === "workspace" && (!kind.extensionId || kind.extensionId === "pstdio"),
        )),
  );
};

export const resolveWorkspacePresentation = (
  ctx: Pick<WorkbenchModuleContext, "pages" | "resources">,
  resource?: ResourceRef,
) => {
  const current =
    resource && (ctx.resources.getKind("workspace", resource.extensionId ?? "pstdio")?.resolve?.(resource) ?? resource);
  const path = workspacePresentationPath(current);
  const page = resolvePresentationPage(ctx, path);
  if (!page) throw new Error(`Workspace presentation is unavailable: ${path}`);
  return page.ref;
};

const presentationAliases = (ctx: Pick<WorkbenchModuleContext, "pages" | "resources">) => {
  const desired = new Map<
    string,
    {
      ref: PageRef;
      path: string;
      target: PageRef | ((resource: ResourceRef | undefined) => PageRef);
      key: string;
    }
  >();
  const add = (
    ref: PageRef,
    path: string,
    target: PageRef | ((resource: ResourceRef | undefined) => PageRef),
    key: string,
  ) => {
    const id = contributionRefId(ref);
    if (ctx.pages.listPages().some((page) => !page.redirect && contributionRefId(page.ref) === id)) return;
    desired.set(id, { ref, path, target, key });
  };
  const home = resolvePresentationPage(ctx, "home");
  if (home) {
    add(workbenchPages.start, "", home.ref, home.id);
    add(homePages.home, "home", home.ref, home.id);
  }
  const workspaces = resolvePresentationPage(ctx, "workspaces");
  if (workspaces) {
    add(workbenchPages.workspaces, "workspaces", workspaces.ref, workspaces.id);
    add(
      workbenchPages.workspace,
      "workspace",
      (resource) => resolveWorkspacePresentation(ctx, resource),
      (resolvePresentationPage(ctx, "workspace") ?? resolvePresentationPage(ctx, "files") ?? workspaces).id,
    );
    for (const ref of Object.values(workspacePages)) {
      const path = ref === workspacePages.list ? "workspaces" : ref.id;
      const page = resolvePresentationPage(ctx, path);
      if (page) add(ref, path, page.ref, page.id);
    }
  }
  return desired;
};

// Keep aliases until saved host/bundled URLs and published consumers have migrated through a
// breaking API release. They forward navigation; all content and controls belong to the tool.
export const createPresentationModule = () =>
  ({
    id: "dashboard.presentation",
    activate(ctx) {
      const aliases = new Map<string, { key: string; dispose(): void }>();
      let syncing = false;
      const sync = () => {
        if (syncing) return;
        syncing = true;
        try {
          batchWorkbenchChanges(() => {
            const desired = presentationAliases(ctx);
            for (const [id, registration] of aliases) {
              if (desired.get(id)?.key === registration.key) continue;
              aliases.delete(id);
              registration.dispose();
            }
            for (const [id, alias] of desired) {
              if (aliases.has(id)) continue;
              const source = ctx.pages.getPage(alias.key);
              const registration = ctx.pages.registerPage({
                id,
                ref: alias.ref,
                path: alias.path,
                modeId: "project",
                redirect: alias.target,
                resource: source?.resource,
                document: source?.document,
                params: source?.params,
                main: { kind: "panels" },
                slots: [],
              });
              aliases.set(id, { ...registration, key: alias.key });
            }
          });
        } finally {
          syncing = false;
        }
      };
      const unsubscribe = ctx.pages.store.subscribeSelector((state) => state.pages, sync);
      sync();
      return {
        dispose() {
          unsubscribe();
          for (const registration of aliases.values()) registration.dispose();
          aliases.clear();
        },
      };
    },
  }) satisfies WorkbenchModuleContribution;
