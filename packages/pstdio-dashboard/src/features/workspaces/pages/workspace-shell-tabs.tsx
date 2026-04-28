import { Flex, Tabs } from "@chakra-ui/react";
import workspaceChangesExtension, {
  WORKSPACE_CHANGES_EXTENSION_ID,
  WORKSPACE_SHELL_TABS_SLOT,
  type WorkspaceTabComponentProps,
} from "@pstdio/pstdio-ext-workspace-changes";
import { EmptyState } from "@pstdio/ui";
import { FileDiffIcon, ShieldCheck } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { asSyncedRows, eq, getCollection, useLiveQuery } from "@/features/sync/collections";
import type { ApiWorkspaceArtifact } from "@/features/ticket-list/data/api/types";
import { WorkspaceChecksPanel } from "../components/workspace-checks-panel";
import type { WorkspacePageTab } from "./workspace-page-tab";
import {
  filterEnabledWorkspaceTabs,
  resolveSelectedWorkspaceTab,
  type WorkspaceTabContribution,
} from "./workspace-tab-contributions";

type WorkspaceTabRenderProps = WorkspaceTabComponentProps & {
  artifacts: ApiWorkspaceArtifact[];
};

type ExtensionWorkspaceTabView = {
  type: string;
  label: string;
  slot?: string;
  order?: number;
  component?: unknown;
};

interface WorkspaceShellTabsProps extends WorkspaceTabRenderProps {
  selectedTab: WorkspacePageTab;
  onTabChange: (tab: WorkspacePageTab) => void;
}

const isWorkspaceTabView = (
  view: unknown,
): view is ExtensionWorkspaceTabView & { component: ComponentType<WorkspaceTabComponentProps> } => {
  const candidate = view as ExtensionWorkspaceTabView;
  return (
    candidate.type === "workspace.tab" &&
    candidate.slot === WORKSPACE_SHELL_TABS_SLOT &&
    typeof candidate.component === "function"
  );
};

const workspaceChangesTabs = Object.entries(workspaceChangesExtension.views ?? {}).flatMap(([value, view]) => {
  if (value !== "changes" || !isWorkspaceTabView(view)) return [];

  const Component = view.component;

  return [
    {
      value,
      label: view.label,
      order: view.order ?? 0,
      extensionId: WORKSPACE_CHANGES_EXTENSION_ID,
      component: (props: WorkspaceTabRenderProps) => (
        <Component projectId={props.projectId} ticketId={props.ticketId} workspaceId={props.workspaceId} />
      ),
    } satisfies WorkspaceTabContribution<ComponentType<WorkspaceTabRenderProps>>,
  ];
});

const kernelWorkspaceTabs = [
  {
    value: "checks",
    label: "Checks",
    order: 20,
    component: (props: WorkspaceTabRenderProps) => (
      <WorkspaceChecksPanel projectId={props.projectId} ticketId={props.ticketId} artifacts={props.artifacts} />
    ),
  },
] satisfies WorkspaceTabContribution<ComponentType<WorkspaceTabRenderProps>>[];

const workspaceTabs = [...workspaceChangesTabs, ...kernelWorkspaceTabs].sort((left, right) => left.order - right.order);

const TabIcon = (props: { value: WorkspacePageTab }) => {
  const { value } = props;
  const Icon = value === "checks" ? ShieldCheck : FileDiffIcon;
  return <Icon size={14} />;
};

export const WorkspaceShellTabs = (props: WorkspaceShellTabsProps) => {
  const { projectId, ticketId, workspaceId, artifacts, selectedTab, onTabChange } = props;
  const { t } = useTranslation("tickets");
  const { data: rawExtensionInstances } = useLiveQuery(
    (q) =>
      projectId
        ? q
            .from({ instance: getCollection("extension_instances") })
            .where(({ instance }) => eq(instance.project_id, projectId))
            .select(({ instance }) => ({ ...instance }))
        : undefined,
    [projectId],
  );
  const enabledTabs = filterEnabledWorkspaceTabs(workspaceTabs, asSyncedRows(rawExtensionInstances) ?? [], projectId);
  const activeTab = resolveSelectedWorkspaceTab(selectedTab, enabledTabs);

  if (!activeTab) {
    return (
      <Flex flex="1" minH="0" align="center" justify="center" bg="bg.subtle">
        <EmptyState title="No workspace tabs enabled" />
      </Flex>
    );
  }

  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(details) => onTabChange(details.value as WorkspacePageTab)}
      variant="enclosed"
      display="flex"
      flexDirection="column"
      h="full"
      minH="0"
      minW="0"
      flex="1"
      bg="bg.subtle"
      size="sm"
    >
      <Tabs.List h="41px" minH="41px" bg="bg.subtle" borderBottomWidth="1px" borderRadius={0} px="xs" py="1px">
        {enabledTabs.map((tab) => (
          <Tabs.Trigger key={tab.value} value={tab.value} gap="2xs">
            <TabIcon value={tab.value} />
            {t(`workspaceDiffPanel.tabs.${tab.value}`, { defaultValue: tab.label })}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {enabledTabs.map((tab) => {
        const TabComponent = tab.component;
        return (
          <Tabs.Content key={tab.value} value={tab.value} flex="1" minH="0" minW="0" p="0" display="flex">
            <TabComponent projectId={projectId} ticketId={ticketId} workspaceId={workspaceId} artifacts={artifacts} />
          </Tabs.Content>
        );
      })}
    </Tabs.Root>
  );
};
