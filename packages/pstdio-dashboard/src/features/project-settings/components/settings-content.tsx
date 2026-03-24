import { Flex, Stack, Text } from "@chakra-ui/react";
import type { ProjectRepository } from "@/features/project/types";
import type { TicketStatusOption, TicketTag } from "@/features/ticket-list/types";
import { HookEditor } from "./hook-editor";
import { ProjectDangerZone } from "./project-danger-zone";
import { ProjectRepositoriesPanel } from "./project-repositories-panel";
import type { SettingsSection } from "./settings-sidebar";
import { SkillViewer } from "./skill-viewer";
import { TagManager } from "./tag-manager";
import { TemplateEditor } from "./template-editor";
import { TicketStatusManager } from "./ticket-status-manager";

interface SettingsContentProps {
  activeSection: SettingsSection | null;
  projectId: string | undefined;
  projectName: string;
  repositories: ProjectRepository[];
  tags: TicketTag[];
  ticketStatuses: TicketStatusOption[];
  onDeleteTag: (tagId: string) => Promise<void>;
  onHookDeleted: () => void;
  onTemplateDeleted: () => void;
}

interface SettingsPlaceholderProps {
  message: string;
}

interface SettingsTagContentProps {
  projectId: string | undefined;
  tagId?: string;
  tags: TicketTag[];
  onDeleteTag: (tagId: string) => Promise<void>;
}

interface DynamicSettingsContentProps {
  section: DynamicSettingsSection;
  projectId: string | undefined;
  tags: TicketTag[];
  onDeleteTag: (tagId: string) => Promise<void>;
  onHookDeleted: () => void;
  onTemplateDeleted: () => void;
}

interface StaticSettingsContentProps {
  section: StaticSettingsSection;
  projectId: string | undefined;
  projectName: string;
  repositories: ProjectRepository[];
  ticketStatuses: TicketStatusOption[];
}

type DynamicSettingsSection = Exclude<SettingsSection, "ticket-statuses" | "tags" | "repositories" | "danger-zone">;
type StaticSettingsSection = Exclude<SettingsSection, DynamicSettingsSection | "tags">;

const SettingsPlaceholder = (props: SettingsPlaceholderProps) => {
  const { message } = props;

  return (
    <Flex flex="1" justifyContent="center" alignItems="center">
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        {message}
      </Text>
    </Flex>
  );
};

const SettingsTagContent = (props: SettingsTagContentProps) => {
  const { projectId, tagId, tags, onDeleteTag } = props;
  const tag = tagId ? tags.find((entry) => entry.id === tagId) : tags[0];

  if (!tag) {
    return <SettingsPlaceholder message={tagId ? "Tag not found." : "No tags defined. Create one from the sidebar."} />;
  }

  return <TagManager key={tag.id} projectId={projectId} tag={tag} onDeleteTag={onDeleteTag} />;
};

const DynamicSettingsContent = (props: DynamicSettingsContentProps) => {
  const { section, projectId, tags, onDeleteTag, onHookDeleted, onTemplateDeleted } = props;

  if ("tag" in section) {
    return <SettingsTagContent projectId={projectId} tagId={section.tag} tags={tags} onDeleteTag={onDeleteTag} />;
  }

  if ("hook" in section) {
    return <HookEditor key={section.hook} projectId={projectId} hookName={section.hook} onDeleted={onHookDeleted} />;
  }

  if ("skill" in section) {
    return <SkillViewer projectId={projectId} skillName={section.skill} />;
  }

  return (
    <TemplateEditor
      key={section.template}
      projectId={projectId}
      templateName={section.template}
      onDeleted={onTemplateDeleted}
    />
  );
};

const StaticSettingsContent = (props: StaticSettingsContentProps) => {
  const { section, projectId, projectName, repositories, ticketStatuses } = props;

  if (section === "ticket-statuses") {
    return <TicketStatusManager projectId={projectId} statuses={ticketStatuses} />;
  }

  if (section === "repositories") {
    return <ProjectRepositoriesPanel projectId={projectId} repositories={repositories} />;
  }

  return (
    <Stack padding="lg" gap="lg">
      <ProjectDangerZone projectId={projectId} projectName={projectName} />
    </Stack>
  );
};

export const SettingsContent = (props: SettingsContentProps) => {
  const {
    activeSection,
    projectId,
    projectName,
    repositories,
    tags,
    ticketStatuses,
    onDeleteTag,
    onHookDeleted,
    onTemplateDeleted,
  } = props;

  if (!activeSection) {
    return <SettingsPlaceholder message="Select a section from the sidebar." />;
  }

  if (activeSection === "tags") {
    return <SettingsTagContent projectId={projectId} tags={tags} onDeleteTag={onDeleteTag} />;
  }

  if (typeof activeSection === "object") {
    return (
      <DynamicSettingsContent
        section={activeSection}
        projectId={projectId}
        tags={tags}
        onDeleteTag={onDeleteTag}
        onHookDeleted={onHookDeleted}
        onTemplateDeleted={onTemplateDeleted}
      />
    );
  }

  return (
    <StaticSettingsContent
      section={activeSection}
      projectId={projectId}
      projectName={projectName}
      repositories={repositories}
      ticketStatuses={ticketStatuses}
    />
  );
};
