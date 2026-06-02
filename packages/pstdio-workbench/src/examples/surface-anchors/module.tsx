import {
  type ResourceRef,
  resolveAnchorArea,
  standardResourceIcons,
  type WorkbenchModuleContribution,
} from "../../core";
import { ConceptPanel } from "./components/concept-panel";
import { PrimaryVsGlobalPanel } from "./components/primary-vs-global";
import { ResourcePanel } from "./components/resource-panel";
import { WorkspaceDetail } from "./components/workspace-detail";
import {
  findWorkspaceByUri,
  SESSION_KIND,
  surfaceWorkspaces,
  TERMINAL_KIND,
  WORKSPACE_KIND,
  workspaceResource,
} from "./mock-data";

const widgetIds = {
  workspace: "surface.workspace.detail",
  concept: "surface.concept",
  primaryVsGlobal: "surface.primary-vs-global",
  session: "surface.session.view",
  terminal: "surface.terminal.view",
};

// Routes a resource to the anchor its kind declares (surface routing), so a session lands
// in the attached anchor and a terminal in the secondary anchor without the opener
// hardcoding an area.
const openBySurface = (
  ctx: Parameters<WorkbenchModuleContribution["activate"]>[0],
  widgetId: string,
  resource: ResourceRef,
) => {
  const surface = ctx.resources.getSurface(resource);
  const area = surface ? resolveAnchorArea(surface) : undefined;
  return ctx.layout.openWidget(widgetId, { resource, area });
};

export const createSurfaceAnchorsModule = (): WorkbenchModuleContribution => ({
  id: "surface-anchors",
  activate(ctx) {
    // Kinds declare which anchor they route to (primary / secondary / attached).
    ctx.resources.registerKind({
      kind: WORKSPACE_KIND,
      label: "Workspace",
      icon: standardResourceIcons.workspace,
      surface: "primary",
    });
    ctx.resources.registerKind({
      kind: TERMINAL_KIND,
      label: "Terminal",
      icon: "SquareTerminal",
      surface: "secondary",
    });
    ctx.resources.registerKind({ kind: SESSION_KIND, label: "Session", icon: "MessageCircle", surface: "attached" });

    // Scoped candidate providers: a session/terminal is only listed while its workspace
    // is the active primary. This is what makes the detached session disconnect.
    ctx.resources.registerProvider({
      id: "surface.sessions",
      kind: SESSION_KIND,
      list: (_query, context) =>
        (findWorkspaceByUri(context.primary?.uri)?.sessions ?? []).map((resource) => ({ resource })),
    });
    ctx.resources.registerProvider({
      id: "surface.terminals",
      kind: TERMINAL_KIND,
      list: (_query, context) =>
        (findWorkspaceByUri(context.primary?.uri)?.terminals ?? []).map((resource) => ({ resource })),
    });

    ctx.resources.registerOpener({
      id: "surface.workspace.opener",
      canOpen: (resource) => resource.kind === WORKSPACE_KIND,
      open: (resource) => ctx.layout.openWidget(widgetIds.workspace, { resource }),
    });
    ctx.resources.registerOpener({
      id: "surface.session.opener",
      canOpen: (resource) => resource.kind === SESSION_KIND,
      open: (resource) => openBySurface(ctx, widgetIds.session, resource),
    });
    ctx.resources.registerOpener({
      id: "surface.terminal.opener",
      canOpen: (resource) => resource.kind === TERMINAL_KIND,
      open: (resource) => openBySurface(ctx, widgetIds.terminal, resource),
    });

    // Primary anchor (main) + its two info projections (left/right) and the two side
    // anchors (secondary = terminals, floating = sessions).
    ctx.layout.registerWidget({
      id: widgetIds.workspace,
      title: "Workspace",
      area: "main",
      rendererId: widgetIds.workspace,
    });
    ctx.layout.registerWidget({
      id: widgetIds.concept,
      title: "Surface map",
      area: "main-left",
      rendererId: widgetIds.concept,
    });
    ctx.layout.registerWidget({
      id: widgetIds.primaryVsGlobal,
      title: "Primary vs global",
      area: "main-right",
      rendererId: widgetIds.primaryVsGlobal,
    });
    ctx.layout.registerWidget({
      id: widgetIds.session,
      title: "Session",
      area: "floating",
      rendererId: widgetIds.session,
    });
    ctx.layout.registerWidget({
      id: widgetIds.terminal,
      title: "Terminal",
      area: "secondary",
      rendererId: widgetIds.terminal,
    });

    ctx.renderers.registerRenderer({ id: widgetIds.workspace, render: (input) => <WorkspaceDetail input={input} /> });
    ctx.renderers.registerRenderer({ id: widgetIds.concept, render: () => <ConceptPanel /> });
    ctx.renderers.registerRenderer({
      id: widgetIds.primaryVsGlobal,
      render: (input) => <PrimaryVsGlobalPanel input={input} />,
    });
    ctx.renderers.registerRenderer({
      id: widgetIds.session,
      render: (input) => <ResourcePanel input={input} anchor="attached (floating)" />,
    });
    ctx.renderers.registerRenderer({
      id: widgetIds.terminal,
      render: (input) => <ResourcePanel input={input} anchor="derived (secondary)" />,
    });

    ctx.layout.openWidget(widgetIds.concept, { pinned: true });
    ctx.layout.openWidget(widgetIds.primaryVsGlobal, { pinned: true });
    void ctx.resources.openResource(workspaceResource(surfaceWorkspaces[0]));
  },
});
