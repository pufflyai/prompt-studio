import { Box, Center } from "@chakra-ui/react";
import { contributionRefId, resourceKey } from "@pstdio/sdk/extensions";
import { sizesToContentHeight } from "pstdio-extensions/bridge/contract";
import type { ReactNode } from "react";
import type {
  RegisteredPlaceholderContribution,
  RegisteredWidgetContribution,
  RegisteredWorkbenchView,
  WorkbenchCore,
  WorkbenchPanelContribution,
  WorkbenchPanelRenderInput,
  WorkbenchRegion,
  WorkbenchWidgetPlacement,
} from "../../core";
import { getWorkbenchRenderers } from "../../core";
import { toPanelContribution, toPanelInstance } from "../../core/registries/layout/panel-api";
import { WorkbenchActionErrors } from "../notifications/action-errors";
import { WorkbenchResourceActivity } from "../resource-activity/resource-activity";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { presentsResourceActivity } from "./resource-activity-presentation";
import { WorkbenchWidgetContents } from "./widget-contents";

interface WorkbenchWidgetHostProps {
  workbench: WorkbenchCore;
  placement: WorkbenchWidgetPlacement;
  /** Render an instance-owned companion view without replacing the owning viewer identity. */
  viewId?: string;
  widget?: RegisteredWidgetContribution | RegisteredPlaceholderContribution;
  region?: WorkbenchRegion;
  sizing?: WorkbenchPanelRenderInput["sizing"];
  visible?: WorkbenchPanelRenderInput["visible"];
  placementOpen?: WorkbenchPanelRenderInput["placementOpen"];
  placementSelected?: WorkbenchPanelRenderInput["placementSelected"];
}

const WorkbenchWidgetFallback = (props: { label: string }) => {
  const { label } = props;

  return (
    <Center h="full" w="full" color="fg.muted" p="md" aria-label={label}>
      <WorkbenchIcon name="circle-alert" size={20} />
    </Center>
  );
};

const WorkbenchRenderedWidgetFrame = (props: { children: ReactNode; centered: boolean; contentHeight: boolean }) => {
  const { children } = props;

  return (
    <Box
      flex="1"
      minW="0"
      minH="0"
      w="full"
      h={props.contentHeight ? "auto" : "full"}
      overflow="hidden"
      display={props.centered ? "flex" : undefined}
      alignItems={props.centered ? "center" : undefined}
    >
      {children}
    </Box>
  );
};

const noopRefresh = () => undefined;

const toHostedPanel = (input: {
  placement: WorkbenchWidgetPlacement;
  region?: WorkbenchRegion;
  view?: RegisteredWorkbenchView;
  widget?: RegisteredWidgetContribution | RegisteredPlaceholderContribution;
}) => {
  if (input.view) {
    return {
      id: input.placement.contributionId,
      title: input.placement.title ?? input.view.title,
      icon: input.view.icon,
      region: input.region ?? input.widget?.region ?? "main",
      rendererId: input.view.id,
    } satisfies WorkbenchPanelContribution;
  }
  if (input.widget) {
    if ("singleton" in input.widget) return toPanelContribution(input.widget as RegisteredWidgetContribution);
    return input.widget;
  }
  return undefined;
};

export const WorkbenchWidgetHost = (props: WorkbenchWidgetHostProps) => {
  const { workbench, placement } = props;
  const widget = props.widget ?? workbench.layout.getWidget(placement.contributionId);
  const viewId = props.viewId ?? placement.viewId;
  const view = viewId ? workbench.views.getView(viewId) : undefined;
  const rendererId = view?.id ?? widget?.rendererId ?? "";
  const refresh = noopRefresh;
  const rendererFromStore = useWorkbenchStore(
    getWorkbenchRenderers(workbench).store,
    (state) => state.renderers[rendererId],
  );
  const renderer = rendererFromStore ?? getWorkbenchRenderers(workbench).getRenderer(rendererId);
  useWorkbenchStore(getWorkbenchRenderers(workbench).store, (state) => state.refreshKeys[rendererId] ?? 0);

  const instance = toPanelInstance(placement);
  const resource = instance.resource;
  const activity = useWorkbenchStore(workbench.resources.store, () =>
    resource ? workbench.resources.getKind(resource.type, resource.extensionId)?.activity : undefined,
  );
  const showsActivity = useWorkbenchStore(workbench.pages.store, () =>
    presentsResourceActivity(
      resource,
      view?.body.kind,
      workbench.pages.listPages(),
      view?.id,
      (ref) => workbench.views.getView(contributionRefId(ref))?.id,
    ),
  );

  if (!widget && !view) {
    return <WorkbenchWidgetFallback label="Widget contribution is no longer registered." />;
  }
  const panel = toHostedPanel({ placement, region: props.region, view, widget });
  if (!panel) return <WorkbenchWidgetFallback label="View contribution is no longer registered." />;

  return (
    // `flex: 1 0 auto` lets the host fill its region when the widget is short and
    // grow past it when the widget is tall, so the region's ScrollArea can scroll.
    <Box
      data-workbench-presentation={placement.widgetId}
      data-workbench-view={view?.id ?? placement.contributionId}
      data-workbench-view-kind={view?.body.kind}
      data-workbench-renderer={renderer ? "mounted" : "missing"}
      display="flex"
      flexDirection="column"
      flex="1 0 auto"
      minW="0"
      minH="0"
      w="full"
      position="relative"
      overflow="hidden"
      // A tree owns its scrollbar. Its virtual spacer must not size the region
      // to the full file list and turn every row into a visible row.
      contain={view?.body.kind === "tree" && !sizesToContentHeight(props.sizing) ? "size" : undefined}
    >
      <WorkbenchActionErrors workbench={workbench} target={placement.widgetId} />
      {renderer ? (
        <WorkbenchRenderedWidgetFrame
          centered={props.region === "status" || Boolean(props.viewId)}
          contentHeight={sizesToContentHeight(props.sizing)}
        >
          <WorkbenchWidgetContents
            renderer={renderer}
            webview={view?.body.kind === "webview" || renderer.id === "webview:bridge"}
            input={{
              workbench,
              panel,
              instance,
              viewId: view?.id,
              refresh,
              sizing: props.sizing,
              visible: props.visible,
              placementOpen: props.placementOpen,
              placementSelected: props.placementSelected,
            }}
            // File views start an async read; their heavy editors load separately.
            defer={view?.body.kind !== "file" && ["main", "side", "bottom"].includes(panel.region)}
          />
        </WorkbenchRenderedWidgetFrame>
      ) : (
        <WorkbenchWidgetFallback label={`No renderer registered for ${rendererId}.`} />
      )}
      {!props.viewId &&
        !workbench.viewMenus
          .listViewMenus()
          .some((menu) => menu.ownerViewId === view?.id && menu.purpose === "activity") &&
        resource &&
        activity &&
        showsActivity &&
        props.region === "main" && (
          <WorkbenchResourceActivity
            key={resourceKey(resource)}
            workbench={workbench}
            binding={activity}
            resource={resource}
            visible={props.visible ?? true}
          />
        )}
    </Box>
  );
};
