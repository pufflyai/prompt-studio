import { Button, Flex, IconButton, Menu } from "@chakra-ui/react";
import { ListRow, toaster } from "@pstdio/ui";
import { useParams } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { getSlotContributions } from "../contribution-mapping";
import { useExecuteExtensionCommand, useProjectExtensionMetadata } from "../hooks/use-project-extensions";
import { buildExtensionCommandRequest } from "../slot-context";
import type { ExtensionResourceContext } from "../types";

interface ExtensionMenuSlotProps {
  slotId: string;
  /**
   * "buttons" renders every contribution as an inline button (use for "primary" slots like header buttons).
   * "overflow" collapses every contribution into a single `…` menu (use for overflow slots).
   */
  mode: "buttons" | "overflow";
  resource?: ExtensionResourceContext;
}

export const ExtensionMenuSlot = (props: ExtensionMenuSlotProps) => {
  const { slotId, mode, resource } = props;
  const { projectId } = useParams({ strict: false });
  const { data } = useProjectExtensionMetadata(projectId);
  const executeCommand = useExecuteExtensionCommand(projectId);
  const contributions = getSlotContributions(data?.menuContributions ?? [], slotId);

  if (!projectId || contributions.length === 0) {
    return null;
  }

  const runContribution = (contribution: (typeof contributions)[number]) => {
    executeCommand.mutate(
      {
        commandId: contribution.commandId,
        body: buildExtensionCommandRequest({
          projectId,
          slotId,
          kind: "menu",
          params: contribution.params,
          resource,
        }),
      },
      {
        onError: (error) =>
          toaster.create({ type: "error", title: "Extension command failed", description: error.message }),
      },
    );
  };

  if (mode === "buttons") {
    return (
      <Flex align="center" gap="xs">
        {contributions.map((contribution) => (
          <Button key={contribution.id} size="sm" variant="outline" onClick={() => runContribution(contribution)}>
            {contribution.label}
          </Button>
        ))}
      </Flex>
    );
  }

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <IconButton size="sm" variant="ghost" aria-label="Extension actions">
          <MoreHorizontal size={16} />
        </IconButton>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="220px" bg="bg">
          {contributions.map((contribution) => (
            <Menu.Item key={contribution.id} value={contribution.id} asChild>
              <ListRow
                asChild
                variant="compact"
                id={contribution.id}
                label={contribution.label}
                onActivate={() => runContribution(contribution)}
              />
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};
