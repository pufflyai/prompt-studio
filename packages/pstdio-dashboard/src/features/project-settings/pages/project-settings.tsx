import { Stack } from "@chakra-ui/react";
import { type BreadcrumbItem, toaster } from "@pstdio/ui";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { ShellWorkbench } from "pstdio-shell/react";
import { useEffect, useState } from "react";
import { useProject, useProjectTemplateAssets } from "@/features/project/hooks/use-project";
import {
  useCreateProjectTicketTag,
  useDeleteProjectTicketTag,
  useProjectTicketStatuses,
} from "@/features/ticket-list/hooks/use-project-tickets";
import {
  createDashboardProjectResource,
  createDashboardProjectShell,
  PROJECT_SETTINGS_SIDEBAR_WIDGET_ID,
  PROJECT_SETTINGS_WIDGET_ID,
} from "@/shared/shell/dashboard-project-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "@/shared/shell/menu-locations";
import { CreateTemplateDialog } from "../components/create-template-dialog";
import { SettingsContent } from "../components/settings-content";
import { type SettingsSection, SettingsSidebar } from "../components/settings-sidebar";
import { useProjectAttemptStatuses } from "../hooks/use-attempt-statuses";

import { useProjectSkills } from "../hooks/use-skills";
import { ensureValidSettingsSection, parseSettingsPanel, toSettingsPanel } from "../utils/settings-panel";

interface ProjectSettingsSidebarWidgetProps {
  activeSection: SettingsSection | null;
  skills: ReturnType<typeof useProjectSkills>["data"];
  tags: NonNullable<ReturnType<typeof useProject>["data"]>["ticketTags"];
  templates: ReturnType<typeof useProjectTemplateAssets>["data"];
  onCreateTag: () => void;
  onCreateTemplate: () => void;
  onSelectSection: (section: SettingsSection) => void;
}

const ProjectSettingsSidebarWidget = (props: ProjectSettingsSidebarWidgetProps) => {
  const { activeSection, skills, tags, templates, onCreateTag, onCreateTemplate, onSelectSection } = props;

  return (
    <SettingsSidebar
      templates={templates ?? []}
      skills={skills ?? []}
      tags={tags}
      activeSection={activeSection}
      onSelectSection={onSelectSection}
      onCreateTemplate={onCreateTemplate}
      onCreateTag={onCreateTag}
    />
  );
};

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

interface CreateProjectSettingsShellInput {
  projectId: string;
  projectName: string;
  navigate: (path: string) => void;
}

const createProjectSettingsShell = (input: CreateProjectSettingsShellInput) => {
  const shell = createDashboardProjectShell({ ...input, showProjectNavigationTree: false });
  const projectResource = createDashboardProjectResource(input);

  shell.layout.openWidget(PROJECT_SETTINGS_SIDEBAR_WIDGET_ID, {
    resource: projectResource,
    closable: false,
  });
  shell.layout.openWidget(PROJECT_SETTINGS_WIDGET_ID, {
    resource: projectResource,
    closable: false,
  });

  return shell;
};

export const ProjectSettings = () => {
  const navigate = useNavigate();
  const { projectId } = useParams({ strict: false });
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
  const breadcrumbItems: BreadcrumbItem[] = [{ title: projectName }, { title: "Settings" }];
  const [projectShell, setProjectShell] = useState(() =>
    createProjectSettingsShell({
      projectId: resolvedProjectId,
      projectName,
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

  useEffect(() => {
    const sidebar = projectShell.renderers.registerRenderer({
      id: PROJECT_SETTINGS_SIDEBAR_WIDGET_ID,
      render: () => (
        <ProjectSettingsSidebarWidget
          activeSection={activeSection}
          skills={skills}
          tags={tags}
          templates={templates}
          onCreateTag={handleCreateTag}
          onCreateTemplate={() => setIsCreateTemplateOpen(true)}
          onSelectSection={setActiveSection}
        />
      ),
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
      sidebar.dispose();
      main.dispose();
    };
  });

  useEffect(() => {
    setActiveSection(parseSettingsPanel(panel));
  }, [panel]);

  useEffect(() => {
    const nextShell = createProjectSettingsShell({
      projectId: resolvedProjectId,
      projectName,
      navigate: (path) => navigate({ to: path }),
    });

    setProjectShell((previousShell) => {
      previousShell.dispose();
      return nextShell;
    });

    return () => nextShell.dispose();
  }, [navigate, projectName, resolvedProjectId]);

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
  }, [activeSection, navigate, panel, projectId]);

  return (
    <ShellWorkbench
      shell={projectShell}
      breadcrumbItems={breadcrumbItems}
      commandPaletteMenuPath={DASHBOARD_COMMAND_PALETTE_MENU}
      showCommandPaletteTreeNode={false}
    />
  );
};
