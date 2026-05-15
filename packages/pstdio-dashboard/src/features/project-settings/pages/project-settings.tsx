import { Stack } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ShellWorkbench } from "pstdio-shell/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackToDashboard } from "@/features/project/components/back-to-dashboard";
import { useProject, useProjectTemplateAssets } from "@/features/project/hooks/use-project";
import {
  useCreateProjectTicketTag,
  useDeleteProjectTicketTag,
  useProjectTicketStatuses,
} from "@/features/ticket-list/hooks/use-project-tickets";
import { PROJECT_SETTINGS_WIDGET_ID } from "@/shared/shell/dashboard-project-shell";
import { useShell } from "@/shared/shell/use-shell";
import { CreateTemplateDialog } from "../components/create-template-dialog";
import { SettingsContent } from "../components/settings-content";
import { createProjectSettingsSectionResource, PROJECT_SETTINGS_TREE_ID } from "../components/settings-navigation-tree";
import { useProjectAttemptStatuses } from "../hooks/use-attempt-statuses";
import { useProjectSkills } from "../hooks/use-skills";
import {
  createProjectSettingsShell,
  PROJECT_SETTINGS_BACK_WIDGET_ID,
  type ProjectSettingsNavigationState,
} from "../utils/project-settings-shell";
import { ensureValidSettingsSection, parseSettingsPanel, toSettingsPanel } from "../utils/settings-panel";
import type { SettingsSection } from "../utils/settings-section";

interface ProjectSettingsMainWidgetProps {
  activeSection: SettingsSection | null;
  attemptStatuses: NonNullable<ReturnType<typeof useProjectAttemptStatuses>["data"]>;
  isCreateTemplateOpen: boolean;
  projectId?: string;
  projectName: string;
  repositories: NonNullable<ReturnType<typeof useProject>["data"]>["repositories"];
  tags: NonNullable<ReturnType<typeof useProject>["data"]>["ticketTags"];
  ticketStatuses: NonNullable<ReturnType<typeof useProjectTicketStatuses>["data"]>;
  onCloseCreateTemplate: () => void;
  onDeleteTag: (tagId: string) => Promise<void>;
  onTemplateCreated: (name: string) => void;
  onTemplateDeleted: () => void;
}

const ProjectSettingsMainWidget = (props: ProjectSettingsMainWidgetProps) => {
  const {
    activeSection,
    attemptStatuses,
    isCreateTemplateOpen,
    projectId,
    projectName,
    repositories,
    tags,
    ticketStatuses,
    onCloseCreateTemplate,
    onDeleteTag,
    onTemplateCreated,
    onTemplateDeleted,
  } = props;

  return (
    <Stack flex="1" h="full" minH="0" minW="0" gap="0">
      <Stack flex="1" minH="0" minW="0" overflow="auto">
        <SettingsContent
          activeSection={activeSection}
          projectId={projectId}
          projectName={projectName}
          repositories={repositories}
          tags={tags}
          ticketStatuses={ticketStatuses}
          attemptStatuses={attemptStatuses}
          onDeleteTag={onDeleteTag}
          onTemplateDeleted={onTemplateDeleted}
        />
      </Stack>

      <CreateTemplateDialog
        projectId={projectId}
        open={isCreateTemplateOpen}
        onClose={onCloseCreateTemplate}
        onCreated={onTemplateCreated}
      />
    </Stack>
  );
};

const ProjectSettingsContent = (props: { projectId?: string }) => {
  const { projectId } = props;
  const { t } = useTranslation("projects");
  const navigate = useNavigate();
  const { panel } = useSearch({ strict: false });
  const { data: project } = useProject(projectId);
  const { data: templates } = useProjectTemplateAssets(projectId);
  const { data: skills } = useProjectSkills(projectId);
  const { data: ticketStatuses } = useProjectTicketStatuses(projectId);
  const { data: attemptStatuses } = useProjectAttemptStatuses(projectId);
  const createTag = useCreateProjectTicketTag(projectId);
  const deleteTag = useDeleteProjectTicketTag(projectId);
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(() => parseSettingsPanel(panel));
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);

  const projectName = project?.name ?? "Project";
  const tags = project?.ticketTags ?? [];
  const repositories = project?.repositories ?? [];
  const resolvedProjectId = projectId ?? "";
  const labels = {
    attemptStatuses: "Attempt Statuses",
    createTag: "Create tag",
    createTemplate: t("projectSettings.createTemplate"),
    dangerZone: t("projectSettings.dangerZone"),
    extensionTemplates: t("projectSettings.extensionTemplates", { defaultValue: "Extension templates" }),
    extensions: "Extensions",
    harnesses: t("projectSettings.harnesses"),
    projectTemplates: t("projectSettings.projectTemplates", { defaultValue: "Project templates" }),
    repositories: t("projectSettings.repositories"),
    skills: t("projectSettings.skills"),
    tags: t("projectSettings.tags"),
  };

  const navigationRef = useRef<ProjectSettingsNavigationState>({
    projectId: resolvedProjectId,
    templates: templates ?? [],
    skills: skills ?? [],
    tags,
    labels,
    onCreateTag: () => undefined,
    onCreateTemplate: () => undefined,
    onOpenSection: () => undefined,
  });

  const projectShell = useShell(() =>
    createProjectSettingsShell({
      projectId: resolvedProjectId,
      projectName,
      initialSection: parseSettingsPanel(panel),
      navigation: navigationRef,
      navigate: (path) => navigate({ to: path }),
    }),
  );

  const handleTemplateCreated = (name: string) => {
    setActiveSection({ template: name });
  };

  const handleTemplateDeleted = () => {
    setActiveSection("tags");
  };

  const handleCreateTag = async () => {
    try {
      const tag = await createTag.mutateAsync({ name: "new tag", type: "single_select" });
      setActiveSection({ tag: tag.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create tag.";
      toaster.create({ type: "error", title: "Create tag failed", description: message });
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await deleteTag.mutateAsync(tagId);
      setActiveSection("ticket-statuses");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete tag.";
      toaster.create({ type: "error", title: "Delete tag failed", description: message });
    }
  };

  navigationRef.current = {
    projectId: resolvedProjectId,
    templates: templates ?? [],
    skills: skills ?? [],
    tags,
    labels,
    onCreateTag: handleCreateTag,
    onCreateTemplate: () => setIsCreateTemplateOpen(true),
    onOpenSection: setActiveSection,
  };

  useEffect(() => {
    const back = projectShell.renderers.registerRenderer({
      id: PROJECT_SETTINGS_BACK_WIDGET_ID,
      render: () => <BackToDashboard justifyContent="flex-start" borderRadius="0" px="sm" />,
    });
    const main = projectShell.renderers.registerRenderer({
      id: PROJECT_SETTINGS_WIDGET_ID,
      render: () => (
        <ProjectSettingsMainWidget
          activeSection={activeSection}
          attemptStatuses={attemptStatuses ?? []}
          isCreateTemplateOpen={isCreateTemplateOpen}
          projectId={projectId}
          projectName={projectName}
          repositories={repositories}
          tags={tags}
          ticketStatuses={ticketStatuses ?? []}
          onCloseCreateTemplate={() => setIsCreateTemplateOpen(false)}
          onDeleteTag={handleDeleteTag}
          onTemplateCreated={handleTemplateCreated}
          onTemplateDeleted={handleTemplateDeleted}
        />
      ),
    });

    return () => {
      back.dispose();
      main.dispose();
    };
  });

  useEffect(() => {
    const subscription = projectShell.breadcrumbs.setItems([
      { title: projectName, icon: "FolderKanban" },
      { title: "Settings", icon: "Settings" },
    ]);
    return () => subscription.dispose();
  }, [projectShell, projectName]);

  useEffect(() => {
    setActiveSection(parseSettingsPanel(panel));
  }, [panel]);

  useEffect(() => {
    if (!skills || !tags || !templates) return;
    projectShell.trees.refresh(PROJECT_SETTINGS_TREE_ID);
  }, [projectShell, skills, tags, templates]);

  useEffect(() => {
    if (!activeSection) {
      return;
    }

    const safeSection = ensureValidSettingsSection(activeSection, templates, skills, tags);
    if (safeSection !== activeSection) {
      setActiveSection(safeSection);
    }
  }, [activeSection, skills, tags, templates]);

  useEffect(() => {
    if (!projectId || !activeSection) {
      return;
    }

    projectShell.layout.openWidget(PROJECT_SETTINGS_WIDGET_ID, {
      resource: createProjectSettingsSectionResource(projectId, activeSection),
      closable: false,
    });

    const nextPanel = toSettingsPanel(activeSection);
    if (panel === nextPanel) {
      return;
    }

    navigate({
      to: "/projects/$projectId/settings",
      params: { projectId },
      search: { panel: nextPanel },
      replace: true,
    });
  }, [activeSection, navigate, panel, projectId, projectShell]);

  return <ShellWorkbench shell={projectShell} />;
};

export const ProjectSettings = () => {
  const { projectId } = useParams({ strict: false });

  return <ProjectSettingsContent key={projectId ?? "project-settings"} projectId={projectId} />;
};
