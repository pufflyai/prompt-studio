import { Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { useWorkbenchStore } from "pstdio-workbench/react";
import { lazy, type ReactNode, Suspense } from "react";
import { dashboardSelectedProjectIdContextKey } from "@/shared/app/project-context";
import { createDashboardSettingsTemplateResource, dashboardSettingsResources } from "@/shared/app/resources";
import { ExtensionWebviewFrame } from "@/shared/extensions/components/extension-webview-frame";
import { useProject } from "@/shared/projects/use-project";
import { dashboardCreateTemplateDialogOpenContextKey, dashboardSettingsNavigationTreeViewId } from "../settings-nav";
import { resolveWorkbenchSettingsSection } from "../settings-section";
import { CreateTemplateDialog } from "./create-template-dialog";
import { ExtensionsPanel } from "./extensions-panel";
import { HarnessesPanel } from "./harnesses-panel";
import { ProjectDangerZone } from "./project-danger-zone";
import { ProjectRepositoriesPanel } from "./project-repositories-panel";
import { RuntimePanel } from "./runtime-panel";

const projectlessSections = new Set(["runtime", "harnesses"]);
const SkillViewer = lazy(() => import("./skill-viewer").then((module) => ({ default: module.SkillViewer })));
const TemplateEditor = lazy(() => import("./template-editor").then((module) => ({ default: module.TemplateEditor })));

interface WorkbenchSettingsPanelProps {
  input: WorkbenchWidgetRenderInput;
}

const MissingProjectPanel = () => (
  <Flex h="full" minH="0" align="center" justify="center" p="lg">
    <EmptyState title="No project selected" description="Select a project before editing project settings." />
  </Flex>
);

const LoadingPanel = () => (
  <Flex h="full" minH="0" align="center" justify="center" p="lg">
    <Spinner size="sm" />
  </Flex>
);

const isProjectlessSection = (section: ReturnType<typeof resolveWorkbenchSettingsSection>) =>
  typeof section === "string" && projectlessSections.has(section);

const readExtensionSettingsPanel = (resource: WorkbenchWidgetRenderInput["placement"]["resource"]) => {
  const panel = resource?.metadata?.settingsPanel;
  return panel && typeof panel === "object"
    ? (panel as {
        extensionId: string;
        id: string;
        title: string;
        webview: Parameters<typeof ExtensionWebviewFrame>[0]["webview"];
      })
    : undefined;
};

export const WorkbenchSettingsPanel = (props: WorkbenchSettingsPanelProps) => {
  const { input } = props;
  const selectedProjectIdValue = useWorkbenchStore(
    input.workbench.context.store,
    (state) => state.values[dashboardSelectedProjectIdContextKey],
  );
  const isCreateTemplateOpen = useWorkbenchStore(
    input.workbench.context.store,
    (state) => state.values[dashboardCreateTemplateDialogOpenContextKey] === true,
  );
  const projectId = typeof selectedProjectIdValue === "string" ? selectedProjectIdValue : undefined;
  const section = resolveWorkbenchSettingsSection(input.placement.resource, Boolean(projectId));
  const { data: project, isLoading: isProjectLoading } = useProject(projectId);

  const closeCreateTemplateDialog = () => {
    input.workbench.context.set(dashboardCreateTemplateDialogOpenContextKey, false);
  };

  const handleTemplateCreated = (name: string) => {
    closeCreateTemplateDialog();
    input.workbench.renderers.refresh(dashboardSettingsNavigationTreeViewId);
    void input.workbench.resources.openResource(createDashboardSettingsTemplateResource(name), { replaceActive: true });
  };

  const handleTemplateDeleted = () => {
    input.workbench.renderers.refresh(dashboardSettingsNavigationTreeViewId);
    void input.workbench.resources.openResource(dashboardSettingsResources.runtime, { replaceActive: true });
  };

  if (!projectId && !isProjectlessSection(section)) {
    return <MissingProjectPanel />;
  }

  if (projectId && isProjectLoading) {
    return <LoadingPanel />;
  }

  let content: ReactNode;
  if (section === "runtime") content = <RuntimePanel />;
  else if (section === "harnesses") content = <HarnessesPanel projectId={projectId} />;
  else if (typeof section === "object" && "skill" in section) {
    content = (
      <Suspense fallback={<LoadingPanel />}>
        <SkillViewer projectId={projectId} skillName={section.skill} />
      </Suspense>
    );
  } else if (typeof section === "object" && "template" in section) {
    content = (
      <Suspense fallback={<LoadingPanel />}>
        <TemplateEditor projectId={projectId} templateName={section.template} onDeleted={handleTemplateDeleted} />
      </Suspense>
    );
  } else if (section === "extensions") content = <ExtensionsPanel projectId={projectId} />;
  else if (section === "repositories") {
    content = <ProjectRepositoriesPanel projectId={projectId} repositories={project?.repositories ?? []} />;
  } else if (typeof section === "object" && "extensionSettingsPanel" in section) {
    const panel = readExtensionSettingsPanel(input.placement.resource);
    content = panel ? (
      <ExtensionWebviewFrame
        extensionId={panel.extensionId}
        projectId={projectId}
        title={panel.title}
        webview={panel.webview}
        webviewId={panel.id}
      />
    ) : (
      <MissingProjectPanel />
    );
  } else {
    content = (
      <Stack padding="lg" gap="lg">
        <ProjectDangerZone projectId={projectId} projectName={project?.name ?? "Project"} />
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          Deleting a project immediately removes it from the dashboard after the backend syncs the change.
        </Text>
      </Stack>
    );
  }

  return (
    <>
      {content}
      <CreateTemplateDialog
        projectId={projectId}
        open={isCreateTemplateOpen}
        onClose={closeCreateTemplateDialog}
        onCreated={handleTemplateCreated}
      />
    </>
  );
};
