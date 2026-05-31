import { Flex, Stack, Text } from "@chakra-ui/react";
import { HorizontalMenuStack, PanelLayout, ScrollArea, toaster } from "@pstdio/ui";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useProject, useProjectTemplateAssets } from "@/features/project/hooks/use-project";
import {
  useCreateProjectTicketTag,
  useDeleteProjectTicketTag,
  useProjectTicketStatuses,
} from "@/features/ticket-list/hooks/use-project-tickets";
import { useProjectExtensionMetadata } from "@/shared/extensions/hooks/use-project-extensions";
import { OpenSidebarButton } from "@/shared/sidebar/open-sidebar-button";
import { CreateTemplateDialog } from "../components/create-template-dialog";
import { SettingsContent } from "../components/settings-content";
import { SETTINGS_SIDEBAR_STORAGE_KEY, type SettingsSection, SettingsSidebar } from "../components/settings-sidebar";
import { useProjectAttemptStatuses } from "../hooks/use-attempt-statuses";
import { useProjectSkills } from "../hooks/use-skills";
import {
  ensureValidSettingsSection,
  isProjectlessSection,
  parseSettingsPanel,
  toSettingsPanel,
} from "../utils/settings-panel";

export const ProjectSettings = () => {
  const navigate = useNavigate();
  const { projectId } = useParams({ strict: false });
  const { panel } = useSearch({ strict: false });
  const { data: project } = useProject(projectId);
  const { data: templates } = useProjectTemplateAssets(projectId);
  const { data: skills } = useProjectSkills(projectId);
  const { data: ticketStatuses } = useProjectTicketStatuses(projectId);
  const { data: attemptStatuses } = useProjectAttemptStatuses(projectId);
  const extensionMetadataQuery = useProjectExtensionMetadata(projectId);
  const createTag = useCreateProjectTicketTag(projectId);
  const deleteTag = useDeleteProjectTicketTag(projectId);
  const hasProject = Boolean(projectId);
  const defaultSection: SettingsSection = hasProject ? "tags" : "runtime";
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(
    () => parseSettingsPanel(panel) ?? defaultSection,
  );
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);

  const projectName = project?.name ?? "Project";
  const tags = project?.ticketTags ?? [];
  const extensionSettingsPanels = extensionMetadataQuery.data?.settingsPanels ?? [];

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
    const parsed = parseSettingsPanel(panel);
    setActiveSection(parsed);
  }, [panel]);

  useEffect(() => {
    if (!activeSection) return;
    if (!hasProject && !isProjectlessSection(activeSection)) {
      setActiveSection("runtime");
      return;
    }

    const safeSection = ensureValidSettingsSection(
      activeSection,
      templates,
      skills,
      tags,
      extensionMetadataQuery.data?.settingsPanels,
    );
    if (safeSection !== activeSection) {
      setActiveSection(safeSection);
    }
  }, [activeSection, extensionMetadataQuery.data?.settingsPanels, hasProject, skills, tags, templates]);

  useEffect(() => {
    if (!activeSection) return;

    const nextPanel = toSettingsPanel(activeSection);
    if (panel === nextPanel) return;

    if (projectId) {
      navigate({
        to: "/projects/$projectId/settings",
        params: { projectId },
        search: { panel: nextPanel },
        replace: true,
      });
      return;
    }

    navigate({
      to: "/settings",
      search: { panel: nextPanel },
      replace: true,
    });
  }, [activeSection, navigate, panel, projectId]);

  const sidebar = (
    <SettingsSidebar
      templates={templates ?? []}
      skills={skills ?? []}
      tags={tags}
      extensionSettingsPanels={extensionSettingsPanels}
      activeSection={activeSection}
      onSelectSection={setActiveSection}
      onCreateTemplate={() => setIsCreateTemplateOpen(true)}
      onCreateTag={handleCreateTag}
      hasProject={hasProject}
    />
  );

  return (
    <PanelLayout sidebar={sidebar}>
      <Stack flex="1" minH="0" minW="0" gap="0">
        <HorizontalMenuStack>
          <Flex align="center" gap="sm" minW="0">
            <OpenSidebarButton storageKey={SETTINGS_SIDEBAR_STORAGE_KEY} />
            <Text textStyle="label/S/medium" color="foreground.primary" lineClamp={1}>
              Settings
            </Text>
          </Flex>
        </HorizontalMenuStack>

        <ScrollArea flex="1" minH="0" minW="0" contentProps={{ minH: "100%" }}>
          <SettingsContent
            activeSection={activeSection}
            extensionSettingsPanels={extensionSettingsPanels}
            projectId={projectId}
            projectName={projectName}
            repositories={project?.repositories ?? []}
            tags={tags}
            ticketStatuses={ticketStatuses ?? []}
            attemptStatuses={attemptStatuses ?? []}
            onDeleteTag={handleDeleteTag}
            onTemplateDeleted={handleTemplateDeleted}
          />
        </ScrollArea>
      </Stack>

      <CreateTemplateDialog
        projectId={projectId}
        open={isCreateTemplateOpen}
        onClose={() => setIsCreateTemplateOpen(false)}
        onCreated={handleTemplateCreated}
      />
    </PanelLayout>
  );
};
