import { Badge, Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import type { WorkbenchCore, WorkbenchModuleContribution, WorkbenchWidgetRenderInput } from "../../core";
import { useWorkbenchStore, WorkbenchIcon } from "../../react";

const VARIANT_RESOURCE_KIND = "onboarding.widget-variants.note";
const CONTROLS_WIDGET_ID = "onboarding.widget-variants.controls";
const CONTROLS_RENDERER_ID = "onboarding.widget-variants.controls.renderer";
const DEFAULT_SINGLETON_WIDGET_ID = "onboarding.widget-variants.singleton";
const CLOSABLE_SINGLETON_WIDGET_ID = "onboarding.widget-variants.closable-singleton";
const RESOURCE_WIDGET_ID = "onboarding.widget-variants.resource";
const SCRATCH_WIDGET_ID = "onboarding.widget-variants.scratch";
const VARIANT_RENDERER_ID = "onboarding.widget-variants.renderer";

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

const noteResource = (id: VariantNoteId) => {
  const note = variantNotes[id];

  return {
    kind: VARIANT_RESOURCE_KIND,
    uri: `${VARIANT_RESOURCE_KIND}:${note.id}`,
    id: note.id,
    label: note.label,
    icon: "FileText",
    metadata: { body: note.body },
  };
};

const countPlacements = (placements: { contributionId: string }[], contributionId: string) =>
  placements.filter((placement) => placement.contributionId === contributionId).length;

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
  const mainArea = useWorkbenchStore(workbench.layout.store, (state) => state.layout.areas.main);
  const placements = mainArea.widgets;
  const scratchCount = countPlacements(placements, SCRATCH_WIDGET_ID);

  const openResource = (id: VariantNoteId) => {
    const resource = noteResource(id);
    workbench.layout.openWidget(RESOURCE_WIDGET_ID, { resource, title: resource.label });
  };

  return (
    <Stack h="full" minH="0" p="md" gap="md" overflow="auto" bg="bg.subtle">
      <Stack gap="xs">
        <Text textStyle="title/S/semibold">Widget variants</Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Open each contribution more than once and compare the tabs in the main area.
        </Text>
      </Stack>

      <ControlSection title="Singleton panels">
        <Button
          size="sm"
          justifyContent="flex-start"
          onClick={() => workbench.layout.openWidget(DEFAULT_SINGLETON_WIDGET_ID)}
        >
          <WorkbenchIcon name="Pin" />
          Default singleton
        </Button>
        <Button
          size="sm"
          variant="subtle"
          justifyContent="flex-start"
          onClick={() => workbench.layout.openWidget(CLOSABLE_SINGLETON_WIDGET_ID)}
        >
          <WorkbenchIcon name="X" />
          Closable singleton
        </Button>
      </ControlSection>

      <ControlSection title="Resource tabs">
        <Button size="sm" variant="outline" justifyContent="flex-start" onClick={() => openResource("alpha")}>
          <WorkbenchIcon name="FileText" />
          Open Alpha
        </Button>
        <Button size="sm" variant="outline" justifyContent="flex-start" onClick={() => openResource("beta")}>
          <WorkbenchIcon name="FileText" />
          Open Beta
        </Button>
      </ControlSection>

      <ControlSection title="Duplicate tabs">
        <Button
          size="sm"
          variant="outline"
          justifyContent="flex-start"
          onClick={() =>
            workbench.layout.openWidget(SCRATCH_WIDGET_ID, {
              title: `Scratch ${scratchCount + 1}`,
            })
          }
        >
          <WorkbenchIcon name="CopyPlus" />
          New scratch tab
        </Button>
      </ControlSection>

      <Box borderTopWidth="1px" borderColor="border.muted" pt="md">
        <Stack gap="xs">
          <VariantCount label="default singleton" count={countPlacements(placements, DEFAULT_SINGLETON_WIDGET_ID)} />
          <VariantCount label="closable singleton" count={countPlacements(placements, CLOSABLE_SINGLETON_WIDGET_ID)} />
          <VariantCount label="resource tabs" count={countPlacements(placements, RESOURCE_WIDGET_ID)} />
          <VariantCount label="scratch tabs" count={scratchCount} />
        </Stack>
      </Box>
    </Stack>
  );
};

const VariantFact = (props: { label: string; children: ReactNode }) => {
  const { label, children } = props;

  return (
    <HStack justify="space-between" gap="lg" borderTopWidth="1px" borderColor="border.muted" py="xs">
      <Text textStyle="label/S/regular" color="fg.muted">
        {label}
      </Text>
      <Box minW="0" textAlign="end">
        {children}
      </Box>
    </HStack>
  );
};

const WidgetVariantPanel = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const config = input.widget.config as VariantConfig;
  const singleton = "singleton" in input.widget ? input.widget.singleton : false;
  const reuse = "reuse" in input.widget ? input.widget.reuse : "resource";
  const resourceBody = input.placement.resource?.metadata?.body;

  return (
    <Stack h="full" minH="0" overflow="auto" p="lg" gap="lg" bg="bg">
      <HStack gap="sm" wrap="wrap">
        <Badge colorPalette={config.colorPalette} variant="subtle">
          {singleton ? "singleton" : "tabbed"}
        </Badge>
        <Badge colorPalette={input.placement.closable ? "green" : "gray"} variant="subtle">
          {input.placement.closable ? "closable" : "not closable"}
        </Badge>
        <Badge colorPalette={reuse === "none" ? "purple" : "blue"} variant="subtle">
          reuse {reuse}
        </Badge>
      </HStack>

      <Stack gap="sm" maxW="760px">
        <Text textStyle="title/M/semibold">{input.placement.title ?? config.label}</Text>
        <Text textStyle="paragraph/M/regular">{config.summary}</Text>
        {typeof resourceBody === "string" ? (
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {resourceBody}
          </Text>
        ) : null}
      </Stack>

      <Stack gap="0" maxW="760px">
        <VariantFact label="contribution">
          <Code colorPalette="gray">{input.placement.contributionId}</Code>
        </VariantFact>
        <VariantFact label="placement">
          <Code colorPalette="gray">{input.placement.widgetId}</Code>
        </VariantFact>
        <VariantFact label="resource">
          <Code colorPalette="gray">{input.placement.resourceUri ?? "none"}</Code>
        </VariantFact>
      </Stack>
    </Stack>
  );
};

const variantConfig = (config: VariantConfig) => config;

export const createWidgetVariantsModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.widget-variants",
  activate(ctx) {
    ctx.resources.registerKind({ kind: VARIANT_RESOURCE_KIND, label: "Variant note", icon: "FileText" });
    ctx.resources.registerOpener({
      id: "onboarding.widget-variants.note-opener",
      canOpen: (resource) => resource.kind === VARIANT_RESOURCE_KIND,
      open: (resource) => ctx.layout.openWidget(RESOURCE_WIDGET_ID, { resource, title: resource.label }),
    });

    ctx.layout.registerWidget({
      id: CONTROLS_WIDGET_ID,
      title: "Variants",
      area: "left",
      areaSize: { defaultPx: 280, minPx: 240 },
      rendererId: CONTROLS_RENDERER_ID,
    });
    ctx.renderers.registerRenderer({
      id: CONTROLS_RENDERER_ID,
      render: ({ workbench }) => <WidgetVariantControls workbench={workbench} />,
    });

    ctx.layout.registerWidget({
      id: DEFAULT_SINGLETON_WIDGET_ID,
      title: "Default singleton",
      area: "main",
      rendererId: VARIANT_RENDERER_ID,
      config: variantConfig({
        label: "Default singleton",
        summary: "The workbench reuses one placement and keeps it non-closable unless you opt in.",
        colorPalette: "blue",
      }),
    });
    ctx.layout.registerWidget({
      id: CLOSABLE_SINGLETON_WIDGET_ID,
      title: "Closable singleton",
      area: "main",
      closable: true,
      rendererId: VARIANT_RENDERER_ID,
      config: variantConfig({
        label: "Closable singleton",
        summary: "Use a closable singleton for durable tools the user can dismiss and reopen later.",
        colorPalette: "green",
      }),
    });
    ctx.layout.registerWidget({
      id: RESOURCE_WIDGET_ID,
      title: "Resource tab",
      area: "main",
      singleton: false,
      resourceKinds: [VARIANT_RESOURCE_KIND],
      rendererId: VARIANT_RENDERER_ID,
      config: variantConfig({
        label: "Resource tab",
        summary: "Non-singleton widgets reuse by resource URI, so the same note does not duplicate.",
        colorPalette: "purple",
      }),
    });
    ctx.layout.registerWidget({
      id: SCRATCH_WIDGET_ID,
      title: "Scratch",
      area: "main",
      singleton: false,
      reuse: "none",
      rendererId: VARIANT_RENDERER_ID,
      config: variantConfig({
        label: "Scratch",
        summary: "Scratch views disable reuse, so every open call creates another closable tab.",
        colorPalette: "yellow",
      }),
    });
    ctx.renderers.registerRenderer({
      id: VARIANT_RENDERER_ID,
      render: (input) => <WidgetVariantPanel input={input} />,
    });

    ctx.layout.openWidget(CONTROLS_WIDGET_ID, { pinned: true });
    ctx.layout.openWidget(DEFAULT_SINGLETON_WIDGET_ID);
    ctx.layout.openWidget(CLOSABLE_SINGLETON_WIDGET_ID);
    ctx.layout.openWidget(RESOURCE_WIDGET_ID, { resource: noteResource("alpha"), title: variantNotes.alpha.label });
    ctx.layout.openWidget(RESOURCE_WIDGET_ID, { resource: noteResource("beta"), title: variantNotes.beta.label });
    ctx.layout.openWidget(SCRATCH_WIDGET_ID, { title: "Scratch 1" });
  },
});
