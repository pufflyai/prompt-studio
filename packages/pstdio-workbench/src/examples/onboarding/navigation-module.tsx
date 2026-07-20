import { Badge, Box, Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { useState } from "react";
import type {
  NavigationTarget,
  NavigationTargetItem,
  ResourceRef,
  TreeNode,
  WorkbenchCore,
  WorkbenchModuleContribution,
} from "../../core";
import { WorkbenchIcon } from "../../react";

const NAVIGATION_HOME_WIDGET_ID = "onboarding.navigation.home";
const NAVIGATION_HOME_RENDERER_ID = "onboarding.navigation.home.renderer";
const NAVIGATION_TREE_ID = "onboarding.navigation.tree";
const NAVIGATION_GUIDE_WIDGET_ID = "onboarding.navigation.guide";
const NAVIGATION_GUIDE_RENDERER_ID = "onboarding.navigation.guide.renderer";
const GUIDE_KIND = "onboarding.navigation.guide";
const FOCUS_MAIN_COMMAND_ID = "onboarding.navigation.focus-main";

const navigationGuides = [
  { id: "start", label: "Start here", body: "Opened from a parsed resource target." },
  { id: "commands", label: "Command routing", body: "Opened through a registered resource navigator." },
  { id: "review", label: "Review flow", body: "Opened as the resource part of a compound target." },
] as const;

const guideById = (id: string) => navigationGuides.find((guide) => guide.id === id) ?? navigationGuides[0];

const guideResource = (id: string): ResourceRef => {
  const guide = guideById(id);
  return {
    kind: GUIDE_KIND,
    uri: `${GUIDE_KIND}:${guide.id}`,
    id: guide.id,
    label: guide.label,
    icon: "FileText",
    metadata: { body: guide.body },
  };
};

const describeTarget = (target: NavigationTarget): string => {
  if (target.kind === "compound") return target.targets.map(describeTarget).join(" + ");
  if (target.kind === "resource") return `resource ${target.resource.uri}`;
  if (target.kind === "view") return `view ${target.widgetId}`;
  return `command ${target.commandId}`;
};

const GuideWidget = (props: { resource: ResourceRef | undefined }) => {
  const { resource } = props;

  return (
    <Stack h="full" p="lg" gap="sm" bg="bg">
      <Text textStyle="title/S/semibold">{resource?.label ?? "Guide"}</Text>
      <Text textStyle="paragraph/M/regular">
        {typeof resource?.metadata?.body === "string" ? resource.metadata.body : "No resource was attached."}
      </Text>
      <Code colorPalette="gray">{resource?.uri ?? "no resource"}</Code>
    </Stack>
  );
};

const NavigationTree = (): TreeNode[] =>
  navigationGuides.map((guide) => {
    const resource = guideResource(guide.id);
    return {
      id: resource.uri,
      label: guide.label,
      description: "Tree row with a direct navigation target.",
      icon: "FileText",
      target: { kind: "resource", resource },
    };
  });

const NavigationHome = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;
  const [lastAction, setLastAction] = useState("Run a location, direct target, or resource navigator.");
  const navigatorResource = guideResource("commands");
  const navigatorHref = workbench.navigation.createHref(navigatorResource);

  const runLocation = async (label: string, location: string) => {
    try {
      const target = workbench.navigation.resolveLocation(location);
      await workbench.navigation.openTarget(target);
      setLastAction(`${label}: ${location} -> ${describeTarget(target)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLastAction(`${label}: ${message}`);
    }
  };

  const runResourceNavigator = async () => {
    try {
      await workbench.navigation.navigateResource(navigatorResource);
      setLastAction(`navigator: ${navigatorHref} -> ${navigatorResource.uri}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLastAction(`navigator: ${message}`);
    }
  };

  return (
    <ScrollArea
      h="full"
      minH="0"
      bg="bg"
      contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "md" }}
    >
      <HStack gap="sm" wrap="wrap">
        <Badge colorPalette="blue">parser</Badge>
        <Badge colorPalette="purple">target dispatcher</Badge>
        <Badge colorPalette="green">resource navigator</Badge>
      </HStack>

      <Stack gap="sm" maxW="760px">
        <Text textStyle="paragraph/M/regular">
          Navigation accepts incoming locations, resolves them to typed targets, then dispatches those targets through
          resource openers, widget openers, or commands.
        </Text>
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          The tree on the left uses direct targets; these buttons use a parser or a resource navigator.
        </Text>
      </Stack>

      <Box>
        <Text textStyle="label/S/semibold" mb="2xs">
          Parsed locations
        </Text>
        <HStack gap="sm" wrap="wrap">
          <Button size="sm" onClick={() => runLocation("resource target", "onboarding://guide/start")}>
            <WorkbenchIcon name="FileText" />
            Open guide
          </Button>
          <Button size="sm" onClick={() => runLocation("view target", "onboarding://view/navigation")}>
            <WorkbenchIcon name="PanelLeft" />
            Reveal tree
          </Button>
          <Button size="sm" onClick={() => runLocation("command target", "onboarding://command/focus-main")}>
            <WorkbenchIcon name="Crosshair" />
            Focus main
          </Button>
          <Button size="sm" onClick={() => runLocation("compound target", "onboarding://open/review?tree=true")}>
            <WorkbenchIcon name="ListTree" />
            Open review flow
          </Button>
        </HStack>
      </Box>

      <Box>
        <Text textStyle="label/S/semibold" mb="2xs">
          Resource navigator
        </Text>
        <Button size="sm" variant="subtle" onClick={runResourceNavigator}>
          <WorkbenchIcon name="Route" />
          Navigate {navigatorHref}
        </Button>
      </Box>

      <Stack gap="xs" p="md" borderWidth="1px" borderColor="border.subtle" bg="bg.subtle">
        <Text textStyle="label/S/semibold">Last dispatch</Text>
        <Code colorPalette="gray" whiteSpace="normal">
          {lastAction}
        </Code>
      </Stack>
    </ScrollArea>
  );
};

export const createNavigationModule = (): WorkbenchModuleContribution => ({
  id: "onboarding.navigation",
  activate(ctx) {
    ctx.commands.registerCommand(
      { id: FOCUS_MAIN_COMMAND_ID, label: "Focus main", category: "Onboarding", icon: "Crosshair" },
      { execute: () => ctx.focus.setActiveRegion("main") },
    );

    ctx.resources.registerKind({ kind: GUIDE_KIND, label: "Navigation guide", icon: "FileText" });
    ctx.resources.registerOpener({
      id: "onboarding.navigation.guide-opener",
      canOpen: (resource) => resource.kind === GUIDE_KIND,
      open: (resource) => ctx.layout.openWidget(NAVIGATION_GUIDE_WIDGET_ID, { resource, title: resource.label }),
    });

    ctx.navigation.registerNavigator({
      id: "onboarding.navigation.guide-navigator",
      canNavigate: (resource) => resource.kind === GUIDE_KIND,
      createHref: (resource) => `onboarding://guide/${resource.id ?? "start"}`,
      navigate: (resource) => ctx.layout.openWidget(NAVIGATION_GUIDE_WIDGET_ID, { resource, title: resource.label }),
    });

    ctx.navigation.registerParser({
      id: "onboarding.navigation.parser",
      canParse: (location) => location.startsWith("onboarding://"),
      parse: (location) => {
        const url = new URL(location);
        // The host selects which target shape this location should produce.
        // The path carries the guide id when the target opens a guide resource.
        const pathId = url.pathname.replace(/^\//, "");

        // onboarding://guide/start becomes a resource target. The dispatcher
        // sends resource targets through the registered resource opener above.
        if (url.host === "guide") return { kind: "resource", resource: guideResource(pathId || "start") };

        // onboarding://view/navigation becomes a view target. The dispatcher
        // reveals or opens the registered navigation tree widget.
        if (url.host === "view") return { kind: "view", widgetId: NAVIGATION_TREE_ID };

        // onboarding://command/focus-main becomes a command target. The path is
        // illustrative here; this example routes to a module-owned command.
        if (url.host === "command") return { kind: "command", commandId: FOCUS_MAIN_COMMAND_ID };

        // onboarding://open/review?tree=true becomes a compound target. Compound
        // targets run in order, so this opens the guide and optionally reveals the tree.
        if (url.host === "open") {
          const targets: NavigationTargetItem[] = [{ kind: "resource", resource: guideResource(pathId || "review") }];
          if (url.searchParams.get("tree") === "true") targets.push({ kind: "view", widgetId: NAVIGATION_TREE_ID });
          return { kind: "compound", targets };
        }
        throw new Error(`Unknown onboarding navigation host: ${url.host}`);
      },
    });

    ctx.renderers.registerRenderer({
      id: NAVIGATION_HOME_RENDERER_ID,
      render: ({ workbench }) => <NavigationHome workbench={workbench} />,
    });
    ctx.renderers.registerRenderer({
      id: NAVIGATION_GUIDE_RENDERER_ID,
      render: ({ placement }) => <GuideWidget resource={placement.resource} />,
    });
    ctx.renderers.registerTreeRenderer({
      id: NAVIGATION_TREE_ID,
      title: "Navigation",
      defaultExpandedSectionIds: ["direct-targets"],
      getBody: () => [{ id: "direct-targets", label: "Direct targets", nodes: NavigationTree() }],
      getChildren: () => [],
    });

    ctx.layout.registerWidget({
      id: NAVIGATION_HOME_WIDGET_ID,
      title: "Navigation",
      region: "main",
      singleton: true,
      rendererId: NAVIGATION_HOME_RENDERER_ID,
    });
    ctx.layout.registerWidget({
      id: NAVIGATION_GUIDE_WIDGET_ID,
      title: "Navigation guide",
      region: "main",
      closable: true,
      singleton: true,
      resourceKinds: [GUIDE_KIND],
      rendererId: NAVIGATION_GUIDE_RENDERER_ID,
    });
    ctx.layout.registerWidget({
      id: NAVIGATION_TREE_ID,
      title: "Navigation",
      region: "sidebar",
      singleton: true,
      regionSize: { defaultPx: 260, minPx: 220 },
      rendererId: NAVIGATION_TREE_ID,
    });

    ctx.layout.openWidget(NAVIGATION_TREE_ID);
    ctx.layout.openWidget(NAVIGATION_HOME_WIDGET_ID);
  },
});
