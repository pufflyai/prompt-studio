export const sidePanelsSource = `import {
  getAnchorResource,
  type ResourceRef,
  type WorkbenchCore,
  type WorkbenchModuleContribution,
} from "pstdio-workbench/core";
import { useWorkbenchStore } from "pstdio-workbench/react";

const ITEM_KIND = "docs.item";
const PICKER_ID = "docs.resources";
const PICKER_RENDERER_ID = "docs.resources.renderer";
const CONTEXT_ID = "docs.context";
const CONTEXT_RENDERER_ID = "docs.context.renderer";
const DETAIL_ID = "docs.detail";
const DETAIL_RENDERER_ID = "docs.detail.renderer";
const INSPECTOR_ID = "docs.inspector";
const INSPECTOR_RENDERER_ID = "docs.inspector.renderer";
const ACTIVITY_ID = "docs.activity";
const ACTIVITY_RENDERER_ID = "docs.activity.renderer";

const items = [
  { id: "brief", label: "Design brief", owner: "Product" },
  { id: "audit", label: "API audit", owner: "Platform" },
];

const itemResource = (item: (typeof items)[number]): ResourceRef => ({
  kind: ITEM_KIND,
  uri: \`\${ITEM_KIND}:\${item.id}\`,
  id: item.id,
  label: item.label,
  icon: "FileText",
  metadata: { owner: item.owner },
});

const usePrimaryResource = (workbench: WorkbenchCore) =>
  useWorkbenchStore(workbench.layout.store, (state) =>
    getAnchorResource(state.layout, "primary"),
  );

const ResourcePicker = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const primary = usePrimaryResource(workbench);

  return (
    <nav>
      {items.map((item) => {
        const resource = itemResource(item);
        return (
          <button
            key={item.id}
            aria-pressed={resource.uri === primary?.uri}
            onClick={() => void workbench.resources.openResource(resource)}
          >
            {item.label}
          </button>
        );
      })}
    </nav>
  );
};

const ContextPanel = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const primary = usePrimaryResource(workbench);
  return <aside>Files and actions for {primary?.label ?? "no resource"}</aside>;
};

const Inspector = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const primary = usePrimaryResource(workbench);
  const owner = String(primary?.metadata?.owner ?? "Unassigned");

  return (
    <aside>
      <h3>{primary?.label ?? "No resource"}</h3>
      <p>{owner}</p>
      <code>{primary?.uri}</code>
    </aside>
  );
};

const Activity = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const primary = usePrimaryResource(workbench);
  return <section>Live activity for {primary?.label ?? "no resource"}</section>;
};

export const createSidePanelsModule = (): WorkbenchModuleContribution => ({
  id: "docs.side-panels",
  activate(ctx) {
    ctx.resources.registerKind({
      kind: ITEM_KIND,
      label: "Item",
      icon: "FileText",
      surface: "primary",
    });

    ctx.resources.registerOpener({
      id: "docs.item-opener",
      canOpen: (resource) => resource.kind === ITEM_KIND,
      open: (resource, input) =>
        ctx.layout.openWidget(DETAIL_ID, {
          resource,
          title: resource.label,
          replaceActive: input.replaceActive,
        }),
    });

    ctx.renderers.registerRenderer({
      id: PICKER_RENDERER_ID,
      render: ({ workbench }) => <ResourcePicker workbench={workbench} />,
    });
    ctx.renderers.registerRenderer({
      id: CONTEXT_RENDERER_ID,
      render: ({ workbench }) => <ContextPanel workbench={workbench} />,
    });
    ctx.renderers.registerRenderer({
      id: DETAIL_RENDERER_ID,
      render: ({ placement }) => <main>{placement.resource?.label}</main>,
    });
    ctx.renderers.registerRenderer({
      id: INSPECTOR_RENDERER_ID,
      render: ({ workbench }) => <Inspector workbench={workbench} />,
    });
    ctx.renderers.registerRenderer({
      id: ACTIVITY_RENDERER_ID,
      render: ({ workbench }) => <Activity workbench={workbench} />,
    });

    ctx.layout.registerWidget({
      id: PICKER_ID,
      title: "Resources",
      area: "left",
      rendererId: PICKER_RENDERER_ID,
    });
    ctx.layout.registerWidget({
      id: CONTEXT_ID,
      title: "Context",
      area: "main-left",
      rendererId: CONTEXT_RENDERER_ID,
    });
    ctx.layout.registerWidget({
      id: DETAIL_ID,
      title: "Detail",
      area: "main",
      singleton: false,
      resourceKinds: [ITEM_KIND],
      rendererId: DETAIL_RENDERER_ID,
    });
    ctx.layout.registerWidget({
      id: INSPECTOR_ID,
      title: "Inspector",
      area: "main-right",
      rendererId: INSPECTOR_RENDERER_ID,
    });
    ctx.layout.registerWidget({
      id: ACTIVITY_ID,
      title: "Activity",
      area: "secondary",
      areaSize: { defaultPx: 180, minPx: 128, maxPx: 320 },
      rendererId: ACTIVITY_RENDERER_ID,
    });

    ctx.layout.openWidget(PICKER_ID, { pinned: true });
    ctx.layout.openWidget(CONTEXT_ID, { pinned: true });
    ctx.layout.openWidget(INSPECTOR_ID, { pinned: true });
    ctx.layout.openWidget(ACTIVITY_ID, { pinned: true });
    void ctx.resources.openResource(itemResource(items[0]));
  },
});`;
