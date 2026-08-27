import { IconButton, Stack } from "@chakra-ui/react";
import { Tooltip } from "@pstdio/ui";
import { WorkbenchIcon, type WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useEffect, useState } from "react";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { executeExtensionCommand } from "@/shared/extensions/api";
import { toWorkbenchContributionId } from "@/shared/extensions/contribution-ref";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import { publishExtensionCommandEvent } from "@/shared/extensions/extension-webview-broadcast";
import { getCachedDashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

const placementRank = { first: 0, default: 1, last: 2 } as const;

// Renders extension activity items natively: an icon column that executes the
// declared command on click. No webview is involved, so the rail paints with the
// rest of the chrome.
export const ExtensionActivityRailWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const workbench = input.workbench;
  const [activeModeId, setActiveModeId] = useState(workbench.modes.getActiveModeId());

  useEffect(() => {
    const subscription = workbench.modes.onDidChangeActive(() => {
      setActiveModeId(workbench.modes.getActiveModeId());
    });
    return () => subscription.dispose();
  }, [workbench]);

  const projectId = getDashboardSelectedProjectId(workbench);
  const items = (getCachedDashboardExtensionMetadata(projectId)?.activityItems ?? [])
    .filter((item) =>
      Boolean(activeModeId && item.modes.some((mode) => toWorkbenchContributionId(mode) === activeModeId)),
    )
    .sort((a, b) => placementRank[a.placement ?? "default"] - placementRank[b.placement ?? "default"]);

  const run = async (item: (typeof items)[number]) => {
    const commandId = toWorkbenchContributionId(item.command);
    if (commandId.startsWith("workbench.")) {
      await workbench.commands.executeCommand(commandId, item.params);
      return;
    }
    if (!projectId) return;
    const response = await executeExtensionCommand(projectId, commandId, {
      params: item.params,
      source: "dashboard",
    });
    publishExtensionCommandEvent(response);
  };

  return (
    <Stack as="nav" align="center" gap="2xs" paddingY="sm" h="full" aria-label="Activity">
      {items.map((item) => {
        const title = resolveLocalizableString(item.title, item.extensionId);
        return (
          <Tooltip key={item.id} content={title} positioning={{ placement: "right" }}>
            <IconButton aria-label={title} variant="ghost" size="sm" onClick={() => void run(item)}>
              <WorkbenchIcon name={item.icon} size={18} />
            </IconButton>
          </Tooltip>
        );
      })}
    </Stack>
  );
};
