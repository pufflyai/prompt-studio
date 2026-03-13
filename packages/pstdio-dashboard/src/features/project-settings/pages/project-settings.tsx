import { Flex, Stack, Text } from "@chakra-ui/react";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useProject, useProjectTemplateAssets } from "@/features/project/hooks/use-project";
import { CreateTemplateDialog } from "../components/create-template-dialog";
import { ProjectDangerZone } from "../components/project-danger-zone";
import { type SettingsSection, SettingsSidebar } from "../components/settings-sidebar";
import { TagManager } from "../components/tag-manager";
import { TemplateEditor } from "../components/template-editor";

export const ProjectSettings = () => {
  const { projectId } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { data: templates } = useProjectTemplateAssets(projectId);
  const [activeSection, setActiveSection] = useState<SettingsSection | null>("tags");
  const [isCreateTemplateOpen, setIsCreateTemplateOpen] = useState(false);

  const projectName = project?.name ?? "Project";
  const tags = project?.ticketTags ?? [];

  const handleTemplateCreated = (name: string) => {
    setActiveSection({ template: name });
  };

  const handleTemplateDeleted = () => {
    setActiveSection("tags");
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

    if (activeSection === "tags") {
      return <TagManager projectId={projectId} tags={tags} />;
    }

    if (activeSection === "danger-zone") {
      return (
        <Stack padding="lg" gap="lg">
          <ProjectDangerZone projectId={projectId} projectName={projectName} />
        </Stack>
      );
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
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          onCreateTemplate={() => setIsCreateTemplateOpen(true)}
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
