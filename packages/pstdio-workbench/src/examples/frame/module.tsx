import { Stack, Text } from "@chakra-ui/react";
import {
  classicFrame,
  createWorkbenchCore,
  defineFrame,
  type Frame,
  type FrameNode,
  type WorkbenchModuleContribution,
} from "../../core";

const RENDERER_ID = "frame-example.renderer";

const alternateBody: FrameNode = {
  kind: "split",
  id: "alternate-body",
  direction: "row",
  children: [
    classicFrame.slots["main-header"],
    classicFrame.slots.main,
    {
      kind: "split",
      id: "alternate-secondary",
      direction: "column",
      children: [classicFrame.slots["secondary-header"], classicFrame.slots.secondary],
    },
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
  attached: { slot: "floating", persistence: "detached", candidates: "scoped" },
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
      { area: "main-header", title: "Frame header", description: "Header chrome remains content-derived." },
      { area: "secondary", title: "Secondary panel", description: "Resize or collapse this frame-owned pane." },
      { area: "secondary-header", title: "Secondary header", description: "The header follows its panel." },
      { area: "main-left", title: "Primary tools", description: "A resource companion of the primary slot." },
      { area: "main-right", title: "Details", description: "A second resource companion." },
      { area: "inspector", title: "Unknown inspector", description: "Rendered with default slot chrome." },
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
