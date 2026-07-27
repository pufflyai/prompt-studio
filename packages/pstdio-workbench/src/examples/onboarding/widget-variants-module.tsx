import { Badge, Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { ReactNode } from "react";
import type { WorkbenchCore, WorkbenchModuleContribution, WorkbenchPanelRenderInput } from "../../core";
import { useWorkbenchStore, WorkbenchIcon } from "../../react";

const LOCATION_RESOURCE_KIND = "onboarding.panel-variants.location";
const NOTE_RESOURCE_KIND = "onboarding.panel-variants.note";
const CONTROLS_WIDGET_ID = "onboarding.panel-variants.controls";
const CONTROLS_RENDERER_ID = "onboarding.panel-variants.controls.renderer";
const LOCATION_PANEL_ID = "onboarding.panel-variants.location";
const SINGLETON_SUB_PANEL_ID = "onboarding.panel-variants.singleton-sub-panel";
const RESOURCE_SUB_PANEL_ID = "onboarding.panel-variants.resource-sub-panel";
const SCRATCH_SUB_PANEL_ID = "onboarding.panel-variants.scratch-sub-panel";
const VARIANT_RENDERER_ID = "onboarding.panel-variants.renderer";

interface VariantConfig {
  label: string;
  summary: string;
  colorPalette: "blue" | "green" | "purple" | "yellow";
}

const variantNotes = {
  alpha: {
    id: "alpha",
    label: "Alpha note",
    body: "Reopening this resource activates the existing Alpha tab.",
  },
  beta: {
    id: "beta",
    label: "Beta note",
    body: "Different resource URIs get their own placements.",
  },
} as const;

type VariantNoteId = keyof typeof variantNotes;

const locationResource = {
  kind: LOCATION_RESOURCE_KIND,
  uri: `${LOCATION_RESOURCE_KIND}:overview`,
  id: "overview",
  label: "Widget variants",
  icon: "PanelsTopLeft",
};

const noteResource = (id: VariantNoteId) => {
  const note = variantNotes[id];

  return {
    kind: NOTE_RESOURCE_KIND,
    uri: `${NOTE_RESOURCE_KIND}:${note.id}`,
    id: note.id,
    label: note.label,
    icon: "FileText",
    metadata: { body: note.body },
  };
};

const countPlacements = (placements: { contributionId: string }[], panelId: string) =>
  placements.filter((placement) => placement.contributionId === panelId).length;

const ControlSection = (props: { title: string; children: ReactNode }) => {
  const { title, children } = props;

  return (
    <Stack gap="xs">
      <Text textStyle="label/S/semibold">{title}</Text>
      {children}
    </Stack>
  );
};

const VariantCount = (props: { label: string; count: number }) => {
  const { label, count } = props;

  return (
    <HStack justify="space-between" gap="sm">
      <Text textStyle="label/XS/regular" color="fg.muted" minW="0" truncate>
        {label}
      </Text>
      <Badge colorPalette={count > 0 ? "blue" : "gray"} variant="subtle" minW="2rem" justifyContent="center">
        {count}
      </Badge>
    </HStack>
  );
};

const WidgetVariantControls = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const placements = useWorkbenchStore(workbench.layout.store, (state) => state.layout.regions.main.widgets);
  const scratchCount = placements.filter((placement) => placement.contributionId === SCRATCH_SUB_PANEL_ID).length;

  const openResource = (id: VariantNoteId) => {
    const resource = noteResource(id);
    workbench.layout.openPanel(RESOURCE_SUB_PANEL_ID, { resource, title: resource.label });
  };

  return (
    <ScrollArea
      h="full"
      minH="0"
      bg="bg.subtle"
      contentProps={{ p: "md", display: "flex", flexDirection: "column", gap: "md" }}
    >
      <Stack gap="xs">
        <Text textStyle="title/S/semibold">Panel variants</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          The active Location owns each tabbed Sub Panel in the main region.
        </Text>
      </Stack>

      <ControlSection title="Location">
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Widget variants is the current Location and cannot be closed.
        </Text>
      </ControlSection>

      <ControlSection title="Singleton Sub Panel">
        <Button
          size="sm"
          justifyContent="flex-start"
          onClick={() => workbench.layout.openPanel(SINGLETON_SUB_PANEL_ID)}
        >
          <WorkbenchIcon name="X" />
          Closable singleton
        </Button>
      </ControlSection>

      <ControlSection title="Resource Sub Panels">
        <Button size="sm" variant="outline" justifyContent="flex-start" onClick={() => openResource("alpha")}>
          <WorkbenchIcon name="FileText" />
          Open Alpha
        </Button>
        <Button size="sm" variant="outline" justifyContent="flex-start" onClick={() => openResource("beta")}>
          <WorkbenchIcon name="FileText" />
          Open Beta
        </Button>
      </ControlSection>

      <ControlSection title="Duplicate Sub Panels">
        <Button
          size="sm"
          variant="outline"
          justifyContent="flex-start"
          onClick={() =>
            workbench.layout.openPanel(SCRATCH_SUB_PANEL_ID, {
              title: `Scratch ${scratchCount + 1}`,
            })
          }
        >
          <WorkbenchIcon name="CopyPlus" />
          New scratch Sub Panel
        </Button>
      </ControlSection>

      <Box borderTopWidth="1px" borderColor="border.subtle" pt="md">
        <Stack gap="xs">
          <VariantCount label="Location" count={countPlacements(placements, LOCATION_PANEL_ID)} />
          <VariantCount label="singleton Sub Panel" count={countPlacements(placements, SINGLETON_SUB_PANEL_ID)} />
          <VariantCount label="resource Sub Panels" count={countPlacements(placements, RESOURCE_SUB_PANEL_ID)} />
          <VariantCount label="scratch Sub Panels" count={scratchCount} />
        </Stack>
      </Box>
    </ScrollArea>
  );
};

const VariantFact = (props: { label: string; children: ReactNode }) => {
  const { label, children } = props;

  return (
    <HStack justify="space-between" gap="lg" borderTopWidth="1px" borderColor="border.subtle" py="xs">
      <Text textStyle="label/S/regular" color="fg.muted">
        {label}
      </Text>
      <Box minW="0" textAlign="end">
        {children}
      </Box>
    </HStack>
  );
};

const WidgetVariantPanel = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const config = input.panel.config as VariantConfig;
  const reuse = "reuse" in input.panel ? input.panel.reuse : "resource";
  const resourceBody = input.instance.resource?.metadata?.body;

  return (
    <ScrollArea
      h="full"
      minH="0"
      bg="bg"
      contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "lg" }}
    >
      <HStack gap="sm" wrap="wrap">
        <Badge colorPalette={config.colorPalette} variant="subtle">
          {"role" in input.panel && input.panel.role === "location" ? "Location" : "Sub Panel"}
        </Badge>
        <Badge colorPalette={input.instance.closable ? "green" : "gray"} variant="subtle">
          {input.instance.closable ? "closable" : "not closable"}
        </Badge>
        <Badge colorPalette={reuse === "none" ? "purple" : "blue"} variant="subtle">
          reuse {reuse}
        </Badge>
      </HStack>

      <Stack gap="sm" maxW="760px">
        <Text textStyle="title/M/semibold">{input.instance.title ?? config.label}</Text>
        <Text textStyle="paragraph/M/regular">{config.summary}</Text>
        {typeof resourceBody === "string" ? (
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {resourceBody}
          </Text>
        ) : null}
      </Stack>

      <Stack gap="0" maxW="760px">
        <VariantFact label="contribution">
          <Code colorPalette="gray">{input.instance.panelId}</Code>
        </VariantFact>
        <VariantFact label="placement">
          <Code colorPalette="gray">{input.instance.instanceId}</Code>
        </VariantFact>
        <VariantFact label="resource">
          <Code colorPalette="gray">{input.instance.resourceUri ?? "none"}</Code>
        </VariantFact>
      </Stack>
    </ScrollArea>
  );
};

const variantConfig = (config: VariantConfig) => config;

export const createWidgetVariantsModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.panel-variants",
  activate(ctx) {
    ctx.resources.registerKind({ kind: LOCATION_RESOURCE_KIND, label: "Widget variants", icon: "PanelsTopLeft" });
    ctx.resources.registerKind({ kind: NOTE_RESOURCE_KIND, label: "Variant note", icon: "FileText" });
    ctx.resources.registerPresenter({
      id: "onboarding.panel-variants.location-presenter",
      canOpen: (resource) => resource.kind === LOCATION_RESOURCE_KIND,
      open: (resource) => ctx.layout.openPanel(LOCATION_PANEL_ID, { resource }),
    });
    ctx.resources.registerPresenter({
      id: "onboarding.panel-variants.note-presenter",
      canOpen: (resource) => resource.kind === NOTE_RESOURCE_KIND,
      open: (resource) => ctx.layout.openPanel(RESOURCE_SUB_PANEL_ID, { resource, title: resource.label }),
    });

    ctx.layout.registerPanel({
      closable: false,
      id: CONTROLS_WIDGET_ID,
      title: "Variants",
      region: "sidenav",
      regionSize: { defaultPx: 280, minPx: 240 },
      rendererId: CONTROLS_RENDERER_ID,
    });
    ctx.renderers.registerRenderer({
      id: CONTROLS_RENDERER_ID,
      render: ({ workbench }) => <WidgetVariantControls workbench={workbench} />,
    });

    ctx.layout.registerPanel({
      closable: false,
      id: LOCATION_PANEL_ID,
      title: "Widget variants",
      region: "main",
      resourceKinds: [LOCATION_RESOURCE_KIND],
      rendererId: VARIANT_RENDERER_ID,
      config: variantConfig({
        label: "Widget variants",
        summary: "The Location is the fixed subject. It appears as an uncloseable tab while Sub Panels are open.",
        colorPalette: "blue",
      }),
    });
    ctx.layout.registerPanel({
      closable: true,
      id: SINGLETON_SUB_PANEL_ID,
      title: "Closable singleton",
      region: "main",
      eligibleLocations: { resourceKinds: [LOCATION_RESOURCE_KIND] },
      rendererId: VARIANT_RENDERER_ID,
      config: variantConfig({
        label: "Closable singleton",
        summary: "A singleton Sub Panel has one placement per Location and can be closed and reopened.",
        colorPalette: "green",
      }),
    });
    ctx.layout.registerPanel({
      closable: true,
      id: RESOURCE_SUB_PANEL_ID,
      title: "Resource Sub Panel",
      region: "main",
      singleton: false,
      resourceKinds: [NOTE_RESOURCE_KIND],
      eligibleLocations: { resourceKinds: [LOCATION_RESOURCE_KIND] },
      rendererId: VARIANT_RENDERER_ID,
      config: variantConfig({
        label: "Resource Sub Panel",
        summary: "Resource Sub Panels reuse by resource URI, so reopening the same note selects its existing tab.",
        colorPalette: "purple",
      }),
    });
    ctx.layout.registerPanel({
      closable: true,
      id: SCRATCH_SUB_PANEL_ID,
      title: "Scratch",
      region: "main",
      singleton: false,
      reuse: "none",
      eligibleLocations: { resourceKinds: [LOCATION_RESOURCE_KIND] },
      rendererId: VARIANT_RENDERER_ID,
      config: variantConfig({
        label: "Scratch",
        summary: "Scratch Sub Panels disable reuse, so every open call creates another closable tab.",
        colorPalette: "yellow",
      }),
    });
    ctx.renderers.registerRenderer({
      id: VARIANT_RENDERER_ID,
      render: (input) => <WidgetVariantPanel input={input} />,
    });

    ctx.layout.openPanel(CONTROLS_WIDGET_ID, { pinned: true });
    ctx.breadcrumbs.setItems([
      { title: locationResource.label, icon: locationResource.icon, resource: locationResource },
    ]);
    void ctx.resources.openResource(locationResource).then(() => {
      ctx.layout.openPanel(SINGLETON_SUB_PANEL_ID);
      ctx.layout.openPanel(RESOURCE_SUB_PANEL_ID, { resource: noteResource("alpha"), title: variantNotes.alpha.label });
      ctx.layout.openPanel(RESOURCE_SUB_PANEL_ID, { resource: noteResource("beta"), title: variantNotes.beta.label });
      ctx.layout.openPanel(SCRATCH_SUB_PANEL_ID, { title: "Scratch 1" });
    });
  },
});
