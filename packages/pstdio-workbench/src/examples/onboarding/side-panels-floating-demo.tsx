import { Badge, HStack, Menu, Stack, Text } from "@chakra-ui/react";
import { ListRow, SessionIndicator } from "@pstdio/ui";
import type { WorkbenchCoreContributionContext } from "../../core";
import { WorkbenchIcon } from "../../react";

const SESSION_WIDGET_ID = "onboarding.side-panels.session";
const SESSION_RENDERER_ID = "onboarding.side-panels.session.renderer";
const SESSION_TAB_RENDERER_ID = "onboarding.side-panels.session.tab";
const SESSION_TAB_MENU_RENDERER_ID = "onboarding.side-panels.session.tab-menu";
const CHECKS_WIDGET_ID = "onboarding.side-panels.checks";
const CHECKS_RENDERER_ID = "onboarding.side-panels.checks.renderer";
const CHECKS_TAB_RENDERER_ID = "onboarding.side-panels.checks.tab";

const SessionContent = (props: { rendererRuns: number }) => {
  const { rendererRuns } = props;

  return (
    <Stack data-testid="floating-side-panel-session-content" data-renderer-runs={rendererRuns} gap="sm" p="md">
      <Text textStyle="label/S/semibold">Session A</Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        The live session stays mounted while the Side Panel moves.
      </Text>
    </Stack>
  );
};

const SessionTab = () => (
  <HStack gap="2xs" minW="0">
    <SessionIndicator status="in_progress" boxSize="12px" />
    <Text as="span">Session A</Text>
  </HStack>
);

const SessionTabMenu = () => (
  <>
    <Menu.Item value="new-session" asChild>
      <ListRow
        asChild
        variant="full-width"
        id="new-session"
        label="New session"
        icon={<WorkbenchIcon name="PenBox" />}
      />
    </Menu.Item>
    <Menu.Separator />
    {["Session A", "Session B"].map((label) => (
      <Menu.Item key={label} value={label} asChild>
        <ListRow
          asChild
          variant="full-width"
          id={label}
          label={label}
          icon={<WorkbenchIcon name="MessageCircle" />}
          isSelected={label === "Session A"}
        />
      </Menu.Item>
    ))}
  </>
);

const ChecksContent = () => (
  <Stack gap="sm" p="md">
    <Text textStyle="label/S/semibold">Checks</Text>
    <Text textStyle="paragraph/S/regular" color="fg.muted">
      Three checks completed for this resource.
    </Text>
  </Stack>
);

const ChecksTab = () => (
  <HStack gap="2xs" minW="0">
    <WorkbenchIcon name="CircleCheck" size={12} />
    <Text as="span">Checks</Text>
    <Badge size="sm" colorPalette="green">
      3
    </Badge>
  </HStack>
);

export const registerFloatingSidePanelDemo = (ctx: WorkbenchCoreContributionContext) => {
  let sessionRendererRuns = 0;
  ctx.renderers.registerRenderer({
    id: SESSION_RENDERER_ID,
    render: () => {
      sessionRendererRuns += 1;
      return <SessionContent rendererRuns={sessionRendererRuns} />;
    },
  });
  ctx.renderers.registerRenderer({ id: SESSION_TAB_RENDERER_ID, render: () => <SessionTab /> });
  ctx.renderers.registerRenderer({ id: SESSION_TAB_MENU_RENDERER_ID, render: () => <SessionTabMenu /> });
  ctx.renderers.registerRenderer({ id: CHECKS_RENDERER_ID, render: () => <ChecksContent /> });
  ctx.renderers.registerRenderer({ id: CHECKS_TAB_RENDERER_ID, render: () => <ChecksTab /> });

  ctx.layout.registerPanel({
    eligibleLocations: {},
    id: SESSION_WIDGET_ID,
    title: "Session A",
    region: "side",
    rendererId: SESSION_RENDERER_ID,
    tab: {
      contentRendererId: SESSION_TAB_RENDERER_ID,
      customMenuRendererId: SESSION_TAB_MENU_RENDERER_ID,
    },
  });
  ctx.layout.registerPanel({
    eligibleLocations: {},
    id: CHECKS_WIDGET_ID,
    title: "Checks",
    region: "side",
    rendererId: CHECKS_RENDERER_ID,
    tab: { contentRendererId: CHECKS_TAB_RENDERER_ID },
  });
};

export const openFloatingSidePanelDemo = (ctx: WorkbenchCoreContributionContext) => {
  ctx.layout.openPanel(SESSION_WIDGET_ID, { pinned: true });
  ctx.layout.openPanel(CHECKS_WIDGET_ID, { pinned: true });
};
