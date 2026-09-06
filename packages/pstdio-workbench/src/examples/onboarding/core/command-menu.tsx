import { Button, Stack, Text } from "@chakra-ui/react";
import {
  createWorkbench,
  type WorkbenchPanelRenderInput,
  workbenchCommandPaletteMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "@pstdio/workbench";

const panelId = "host.command-guide";
const placeholderViewId = "host.command-guide.placeholder";
const openCommandId = "host.open-command-guide";
const closeCommandId = "host.close-command-guide";
const panelOpenContextKey = "host.commandGuideOpen";
const CommandPlaceholder = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  return (
    <Stack h="full" align="center" justify="center" gap="sm" bg="bg">
      <Stack gap="xs" textAlign="center">
        <Text textStyle="heading/M/semibold">Nothing is open</Text>
        <Text color="fg.muted">Run the command to open a panel in Main.</Text>
      </Stack>
      <Button onClick={() => void input.workbench.commands.executeCommand(openCommandId)}>Open command panel</Button>
    </Stack>
  );
};
export const createCommandWorkbench = () => {
  const workbench = createWorkbench();
  workbench.registerModule({
    id: "host.command-guide",
    activate(ctx) {
      ctx.views.registerView({
        id: panelId,
        title: "Command guide",
        body: {
          kind: "react",
          render: ({ instance }) => (
            <Stack h="full" gap="sm" p="lg" bg="bg">
              <Text textStyle="heading/M/semibold">{instance.title}</Text>
              <Text color="fg.muted">The placeholder ran a command that opened this panel.</Text>
            </Stack>
          ),
        },
      });
      ctx.shellPlacements.registerPlacement({
        id: panelId,
        item: {
          kind: "view",
          presence: "closed",
          view: {
            kind: "view",
            id: panelId,
          },
        },
        region: "main",
      });
      ctx.views.registerView({
        id: placeholderViewId,
        title: "Command guide",
        body: { kind: "react", render: (input) => <CommandPlaceholder input={input} /> },
      });
      ctx.placeholders.registerPlaceholder({
        id: "host.command-guide.placeholder",
        viewId: placeholderViewId,
        region: "main",
      });
      ctx.commands.registerCommand(
        {
          id: openCommandId,
          label: "Open command panel",
          category: "Onboarding",
          icon: "Plus",
        },
        {
          execute: () => ctx.navigation.openPanel({ panel: { kind: "shell-placement", id: panelId } }),
        },
      );
      ctx.commands.registerCommand(
        {
          id: closeCommandId,
          label: "Close command panel",
          category: "Onboarding",
          icon: "X",
        },
        {
          execute: () => {
            const placement = ctx.layout
              .getLayout()
              .regions.main.widgets.find((candidate) => candidate.viewId === panelId);
            if (placement?.placementIdentity?.kind === "shell") {
              ctx.shellPlacements.closePlacement(placement.placementIdentity);
            }
          },
          isEnabled: () => ctx.context.get(panelOpenContextKey) === true,
        },
      );
      ctx.layout.registerMenuItem(workbenchTopHeaderTrailingMenuPath, {
        commandId: closeCommandId,
        group: "primary",
      });
      // The command palette is a menu path like any other menu. Registering an
      // item makes the command searchable by its label and category.
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: openCommandId, order: 10 });
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, { commandId: closeCommandId, order: 11 });
      const unsubscribe = ctx.layout.store.subscribeSelector(
        (state) => state.layout.regions.main.widgets.some((widget) => widget.viewId === panelId),
        (open) => ctx.context.set(panelOpenContextKey, open),
        { fireImmediately: true },
      );
      return { dispose: unsubscribe };
    },
  });
  return workbench;
};
