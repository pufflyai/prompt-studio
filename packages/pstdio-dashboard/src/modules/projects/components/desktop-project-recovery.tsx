import { Button, Center, Flex } from "@chakra-ui/react";
import { EmptyState, WindowTabs, WindowTitleBar } from "@pstdio/ui";
import { WorkbenchThemeProvider } from "@pstdio/workbench/react";
import type { WorkbenchStorageLike } from "@pstdio/workbench/storage";
import { Folder } from "lucide-react";
import { useEffect, useRef } from "react";
import type { DesktopLifecycleBridge } from "@/lib/desktop-lifecycle-bridge";
import { DesktopQuitConfirmation } from "@/modules/desktop/desktop-quit-confirmation";
import { findDashboardProjectRow } from "../data/project-data";
import type { DesktopProjectTabsController, DesktopProjectWorkbench } from "../desktop-project-tabs-controller";

interface DesktopProjectRecoveryProps {
  controller: DesktopProjectTabsController;
  entry: DesktopProjectWorkbench;
  lifecycle?: DesktopLifecycleBridge;
  platform: string;
  storage?: WorkbenchStorageLike;
  visible: boolean;
}

export const ProjectRecoveryMessage = (props: { canSwitch: boolean; retry: () => void }) => {
  const { canSwitch, retry } = props;
  const retryButton = useRef<HTMLButtonElement>(null);
  useEffect(() => retryButton.current?.focus(), []);
  return (
    <Center as="main" flex="1" p="md">
      <EmptyState
        role="alert"
        title="This project couldn’t open"
        description={canSwitch ? "Try opening it again or switch to another project." : undefined}
      >
        <Button ref={retryButton} onClick={retry}>
          Retry project
        </Button>
      </EmptyState>
    </Center>
  );
};

export const DesktopProjectRecovery = (props: DesktopProjectRecoveryProps) => {
  const { controller, entry, lifecycle, platform, storage, visible } = props;
  if (!visible) return null;
  // Recovery reads just the tab's plain text label. It can also render while its project row is unavailable.
  const tabs = controller.getProjectIds().map((id) => {
    const name = findDashboardProjectRow(id)?.name;
    return {
      id,
      label: typeof name === "string" && name ? name : "Project",
      icon: <Folder aria-hidden="true" />,
      closable: id === entry.projectId,
    };
  });
  return (
    <WorkbenchThemeProvider themeStorage={storage}>
      <Flex direction="column" h="100dvh" minW="0" bg="bg" color="fg">
        <WindowTitleBar platform={platform}>
          <WindowTabs
            aria-label="Project tabs"
            tabs={tabs}
            selectedId={entry.projectId}
            onSelect={(id) => controller.select(id)}
            onClose={(id) => controller.close(id)}
          />
        </WindowTitleBar>
        <ProjectRecoveryMessage canSwitch={tabs.length > 1} retry={() => controller.retry(entry)} />
        {lifecycle && <DesktopQuitConfirmation bridge={lifecycle} />}
      </Flex>
    </WorkbenchThemeProvider>
  );
};
