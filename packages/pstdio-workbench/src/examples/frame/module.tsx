import { IconButton, Stack, Text } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import {
  classicFrame,
  createWorkbenchCore,
  defineFrame,
  type Frame,
  type FrameNode,
  type LayoutPersistenceAdapter,
  layoutScopeKey,
  standardResourceIcons,
  type WorkbenchModuleContribution,
} from "../../core";
import { WorkbenchIcon, type WorkbenchWidgetRenderInput } from "../../react";

const RENDERER_ID = "frame-example.renderer";

const alternateBody: FrameNode = {
  kind: "split",
  id: "alternate-body",
  direction: "row",
  children: [
    classicFrame.slots.main,
    classicFrame.slots.secondary,
    {
      kind: "slot",
      id: "inspector",
      owner: "resource",
      role: "panels",
      size: { defaultPx: 220, minPx: 160, maxPx: 360 },
    },
  ],
};

const replaceBody = (node: FrameNode): FrameNode => {
  if (node.id === "body") return alternateBody;
  if (node.kind === "slot") return node;
  return { ...node, children: node.children.map(replaceBody) };
};

export const alternateFrame = defineFrame({
  id: "alternate",
  root: replaceBody(classicFrame.root),
  primary: "main",
  secondary: { slot: "secondary", persistence: "derived", candidates: "scoped" },
  attached: { slot: "side", persistence: "detached", candidates: "scoped" },
});

export const shellRailFrame = defineFrame({
  id: "shell-rail",
  root: {
    kind: "split",
    id: "shell-rail-workbench",
    direction: "row",
    children: [
      classicFrame.root,
      {
        kind: "slot",
        id: "tool-rail",
        owner: "project",
        role: "chrome",
        size: { defaultPx: 56, minPx: 56, maxPx: 56 },
      },
    ],
  },
  primary: "main",
  secondary: { slot: "secondary", persistence: "derived", candidates: "scoped" },
  attached: { slot: "side", persistence: "detached", candidates: "scoped" },
});

const focusOmissions = new Set(["left", "secondary"]);

const omitFocusSlots = (node: FrameNode): FrameNode | undefined => {
  if (node.kind === "slot") return focusOmissions.has(node.id) ? undefined : node;
  const children = node.children.map(omitFocusSlots).filter((child): child is FrameNode => Boolean(child));
  if (children.length === 0) return undefined;
  return { ...node, children };
};

export const focusFrame = defineFrame({
  id: "focus",
  root: omitFocusSlots(classicFrame.root) as FrameNode,
  primary: "main",
  attached: { slot: "side", persistence: "detached", candidates: "scoped" },
});

interface FrameExamplePanelProps {
  title: string;
  description: string;
}

const FrameExamplePanel = (props: FrameExamplePanelProps) => {
  const { title, description } = props;
  return (
    <Stack h="full" minH="0" p="md" gap="xs">
      <Text textStyle="label/M/semibold">{title}</Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        {description}
      </Text>
    </Stack>
  );
};

const createFrameExampleModule = (frame: Frame): WorkbenchModuleContribution => ({
  id: `frame-example.${frame.id}`,
  activate(ctx) {
    ctx.renderers.registerRenderer({
      id: RENDERER_ID,
      render: ({ placement }) => (
        <FrameExamplePanel
          title={placement.title ?? placement.contributionId}
          description={
            typeof placement.resource?.metadata?.description === "string" ? placement.resource.metadata.description : ""
          }
        />
      ),
    });

    const panels = [
      { area: "main", title: "Primary editor", description: `Rendered by the ${frame.id} frame.` },
      { area: "secondary", title: "Secondary panel", description: "Resize or collapse this frame-owned pane." },
      { area: "side", title: "Details", description: "A resource companion in the unified side panel." },
      { area: "inspector", title: "Unknown inspector", description: "Rendered with default slot chrome." },
      { area: "tool-rail", title: "Tool rail", description: "A novel shell slot rendered by the frame tree." },
    ].filter((panel) => frame.slots[panel.area]);

    for (const panel of panels) {
      const id = `frame-example.${frame.id}.${panel.area}`;
      ctx.layout.registerWidget({ id, title: panel.title, area: panel.area, rendererId: RENDERER_ID });
      ctx.layout.openWidget(id, {
        resource: {
          kind: "frame-example",
          uri: `pstdio://frame-example/${frame.id}/${panel.area}`,
          label: panel.title,
          metadata: { description: panel.description },
        },
      });
    }
  },
});

export const createFrameExampleWorkbench = (frame: Frame) => {
  const workbench = createWorkbenchCore({ frame });
  workbench.registerModule(createFrameExampleModule(frame));
  return workbench;
};

const MODE_SWITCHER_ID = "frame-modes.switcher";
const MODE_RENDERER_ID = "frame-modes.renderer";

const FrameModeSwitcher = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const activeModeId = input.workbench.modes.getActiveModeId();
  const modes = [
    { id: "classic", label: "Classic frame", icon: standardResourceIcons.project },
    { id: "focus", label: "Focus frame", icon: standardResourceIcons.settings },
  ];

  return (
    <Stack h="full" alignItems="center" py="sm" gap="xs">
      {modes.map((mode) => (
        <Tooltip key={mode.id} content={mode.label} positioning={{ placement: "right" }}>
          <IconButton
            aria-label={`Switch to ${mode.label}`}
            size="sm"
            variant={activeModeId === mode.id ? "subtle" : "ghost"}
            onClick={() => {
              input.workbench.modes.setActiveMode(mode.id);
              input.refresh();
            }}
          >
            <WorkbenchIcon name={mode.icon} size={20} />
          </IconButton>
        </Tooltip>
      ))}
    </Stack>
  );
};

const createModeFramesModule = (): WorkbenchModuleContribution => ({
  id: "frame-modes",
  activate(ctx) {
    ctx.renderers.registerRenderer({
      id: MODE_SWITCHER_ID,
      render: (input) => <FrameModeSwitcher input={input} />,
    });
    ctx.renderers.registerRenderer({
      id: MODE_RENDERER_ID,
      render: ({ placement }) => (
        <FrameExamplePanel
          title={placement.title ?? placement.contributionId}
          description="This module-owned panel survives frame swaps."
        />
      ),
    });

    const widgets = [
      { id: MODE_SWITCHER_ID, title: "Frame modes", area: "activity", rendererId: MODE_SWITCHER_ID },
      { id: "frame-modes.navigator", title: "Navigator", area: "left", rendererId: MODE_RENDERER_ID },
      { id: "frame-modes.workspace", title: "Workspace", area: "main", rendererId: MODE_RENDERER_ID },
      { id: "frame-modes.output", title: "Output", area: "secondary", rendererId: MODE_RENDERER_ID },
      { id: "frame-modes.details", title: "Details", area: "side", rendererId: MODE_RENDERER_ID },
      { id: "frame-modes.status", title: "Ready", area: "status", rendererId: MODE_RENDERER_ID },
    ];

    for (const widget of widgets) {
      ctx.layout.registerWidget({ ...widget, singleton: true });
      ctx.layout.openWidget(widget.id, { pinned: true });
    }
    ctx.layout.persist();

    ctx.modes.registerMode({ id: "classic", label: "Classic frame", frame: classicFrame, activate: () => undefined });
    ctx.modes.registerMode({ id: "focus", label: "Focus frame", frame: focusFrame, activate: () => undefined });
    ctx.modes.setActiveMode("classic");
  },
});

export const createModeFramesWorkbench = () => {
  const layouts = new Map<string, ReturnType<WorkbenchWidgetRenderInput["workbench"]["layout"]["getLayout"]>>();
  const layoutPersistence: LayoutPersistenceAdapter = {
    getLayout(scope) {
      const layout = layouts.get(layoutScopeKey(scope)) ?? layouts.get("global");
      return layout ? structuredClone(layout) : undefined;
    },
    setLayout(layout, scope) {
      layouts.set(layoutScopeKey(scope), structuredClone(layout));
    },
  };
  const workbench = createWorkbenchCore({ layoutPersistence });
  workbench.registerModule(createModeFramesModule());
  return workbench;
};
