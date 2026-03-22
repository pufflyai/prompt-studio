import { Flex, Stack, Text } from "@chakra-ui/react";
import { toaster } from "@pstdio/ui";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useProject, useProjectTemplateAssets } from "@/features/project/hooks/use-project";
import {
  useCreateProjectTicketTag,
  useDeleteProjectTicketTag,
  useProjectTicketStatuses,
} from "@/features/ticket-list/hooks/use-project-tickets";
import { CreateTemplateDialog } from "../components/create-template-dialog";
import { HookEditor } from "../components/hook-editor";
import { ProjectDangerZone } from "../components/project-danger-zone";
import { type SettingsSection, SettingsSidebar } from "../components/settings-sidebar";
import { SkillViewer } from "../components/skill-viewer";
import { TagManager } from "../components/tag-manager";
import { TemplateEditor } from "../components/template-editor";
import { TicketStatusManager } from "../components/ticket-status-manager";
import { useProjectHooks, useSaveProjectHook } from "../hooks/use-hooks";
import { useProjectSkills } from "../hooks/use-skills";
import { ensureValidSettingsSection, parseSettingsPanel, toSettingsPanel } from "../utils/settings-panel";

export const ProjectSettings = () => {
  const navigate = useNavigate();
  const { projectId } = useParams({ strict: false });
  const { panel } = useSearch({ strict: false });
  const { data: project } = useProject(projectId);
  const { data: templates } = useProjectTemplateAssets(projectId);
  const { data: hooks } = useProjectHooks(projectId);
  const { data: skills } = useProjectSkills(projectId);
  const { data: ticketStatuses } = useProjectTicketStatuses(projectId);
  const createTag = useCreateProjectTicketTag(projectId);
  const deleteTag = useDeleteProjectTicketTag(projectId);
  const saveHook = useSaveProjectHook(projectId);
  const [activeSection, setActiveSection] = useState<SettingsSection | null>(() => parseSettingsPanel(panel));
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);

  const projectName = project?.name ?? "Project";
  const tags = project?.ticketTags ?? [];

  const handleTemplateCreated = (name: string) => {
    setActiveSection({ template: name });
  };

  const handleTemplateDeleted = () => {
    setActiveSection("tags");
  };

  const handleAddHook = async (hookName: string) => {
    try {
      await saveHook.mutateAsync({ hookName, content: "#!/bin/sh\n" });
      setActiveSection({ hook: hookName });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create hook.";
      toaster.create({ type: "error", title: "Create hook failed", description: message });
    }
  };

  const handleHookDeleted = () => {
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
    setActiveSection(parseSettingsPanel(panel));
  }, [panel]);

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

  const renderTagContent = (tagId?: string) => {
    const tag = tagId ? tags.find((t) => t.id === tagId) : tags[0];
    if (!tag) {
      return (
        <Flex flex="1" justifyContent="center" alignItems="center">
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {tagId ? "Tag not found." : "No tags defined. Create one from the sidebar."}
          </Text>
        </Flex>
      );
    }
    return <TagManager key={tag.id} projectId={projectId} tag={tag} onDeleteTag={handleDeleteTag} />;
  };

  const renderContent = () => {
    if (!activeSection) {
      return (
        <Flex flex="1" justifyContent="center" alignItems="center">
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Select a section from the sidebar.
          </Text>
        </Flex>
      );
    }

    if (activeSection === "tags") return renderTagContent();

    if (typeof activeSection === "object" && "tag" in activeSection) return renderTagContent(activeSection.tag);

    if (activeSection === "ticket-statuses") {
      return <TicketStatusManager projectId={projectId} statuses={ticketStatuses ?? []} />;
    }

    if (activeSection === "danger-zone") {
      return (
        <Stack padding="lg" gap="lg">
          <ProjectDangerZone projectId={projectId} projectName={projectName} />
        </Stack>
      );
    }

    if (typeof activeSection === "object" && "hook" in activeSection) {
      return (
        <HookEditor
          key={activeSection.hook}
          projectId={projectId}
          hookName={activeSection.hook}
          onDeleted={handleHookDeleted}
        />
      );
    }

    if (typeof activeSection === "object" && "skill" in activeSection) {
      return <SkillViewer projectId={projectId} skillName={activeSection.skill} />;
    }

    return (
      <TemplateEditor
        key={activeSection.template}
        projectId={projectId}
        templateName={activeSection.template}
        onDeleted={handleTemplateDeleted}
      />
    );
  };

  return (
    <>
      <Flex height="100%" width="100%" minH="0">
        <SettingsSidebar
          templates={templates ?? []}
          hooks={hooks ?? []}
          skills={skills ?? []}
          tags={tags}
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          onCreateTemplate={() => setIsCreateTemplateOpen(true)}
          onCreateTag={handleCreateTag}
          onAddHook={handleAddHook}
        />
        <Stack flex="1" minH="0" overflow="auto">
          {renderContent()}
        </Stack>
      </Flex>

      <CreateTemplateDialog
        projectId={projectId}
        open={isCreateTemplateOpen}
        onClose={() => setIsCreateTemplateOpen(false)}
        onCreated={handleTemplateCreated}
      />
    </>
  );
};
