import { IconButton, Stack } from "@chakra-ui/react";
import { contributionRefId } from "@pstdio/sdk/extensions";
import { Tooltip } from "@pstdio/ui";
import { runUserAction } from "@pstdio/workbench";
import { WorkbenchIcon, type WorkbenchPanelRenderInput } from "@pstdio/workbench/react";
import { useEffect, useState } from "react";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
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
    .filter((item) => Boolean(activeModeId && item.modes.some((mode) => contributionRefId(mode) === activeModeId)))
    .sort((a, b) => placementRank[a.placement ?? "default"] - placementRank[b.placement ?? "default"]);

  return (
    <Stack as="nav" align="center" gap="2xs" paddingY="sm" h="full" aria-label="Activity">
      {items.map((item) => {
        const title = resolveLocalizableString(item.title, item.extensionId);
        return (
          <Tooltip key={item.id} content={title} positioning={{ placement: "right" }}>
            <IconButton
              aria-label={title}
              variant="ghost"
              size="sm"
              onClick={() =>
                void runUserAction(workbench, title, () =>
                  workbench.commands.executeCommand(contributionRefId(item.command), item.params),
                )
              }
            >
              <WorkbenchIcon name={item.icon} size={18} />
            </IconButton>
          </Tooltip>
        );
      })}
    </Stack>
  );
};
