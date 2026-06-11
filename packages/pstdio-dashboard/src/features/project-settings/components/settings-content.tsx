import { Flex, Stack, Text } from "@chakra-ui/react";
import type { ProjectRepository } from "@/features/project/types";
import type { TicketStatusOption, TicketTag } from "@/features/ticket-list/types";
import { ExtensionWebviewFrame } from "@/shared/extensions/components/extension-webview-frame";
import { resolveLabel, resolveWebviewTitle } from "@/shared/extensions/localized-label";
import type { DashboardExtensionMetadata } from "@/shared/extensions/types";
import type { AttemptStatusOption } from "../hooks/use-attempt-statuses";
import { AttemptStatusManager } from "./attempt-status-manager";
import { ExtensionsPanel } from "./extensions-panel";
import { ProjectDangerZone } from "./project-danger-zone";
import { ProjectRepositoriesPanel } from "./project-repositories-panel";
import { RuntimePanel } from "./runtime-panel";
import type { SettingsSection } from "./settings-sidebar";
import { SkillViewer } from "./skill-viewer";
import { TagManager } from "./tag-manager";
import { TemplateEditor } from "./template-editor";
import { TicketStatusManager } from "./ticket-status-manager";

interface SettingsContentProps {
  activeSection: SettingsSection | null;
  extensionSettingsPanels: DashboardExtensionMetadata["settingsPanels"];
  projectId: string | undefined;
  projectName: string;
  repositories: ProjectRepository[];
  tags: TicketTag[];
  ticketStatuses: TicketStatusOption[];
  attemptStatuses: AttemptStatusOption[];
  onDeleteTag: (tagId: string) => Promise<void>;
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
  extensionSettingsPanels: DashboardExtensionMetadata["settingsPanels"];
  projectId: string | undefined;
  tags: TicketTag[];
  onDeleteTag: (tagId: string) => Promise<void>;
  onTemplateDeleted: () => void;
}

interface StaticSettingsContentProps {
  section: StaticSettingsSection;
  projectId: string | undefined;
  projectName: string;
  repositories: ProjectRepository[];
  ticketStatuses: TicketStatusOption[];
  attemptStatuses: AttemptStatusOption[];
}

type DynamicSettingsSection = Exclude<
  SettingsSection,
  "runtime" | "ticket-statuses" | "attempt-statuses" | "tags" | "extensions" | "repositories" | "danger-zone"
>;
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
  const { section, extensionSettingsPanels, projectId, tags, onDeleteTag, onTemplateDeleted } = props;

  if ("tag" in section) {
    return <SettingsTagContent projectId={projectId} tagId={section.tag} tags={tags} onDeleteTag={onDeleteTag} />;
  }

  if ("extensionSettingsPanel" in section) {
    const panel = extensionSettingsPanels.find((entry) => entry.id === section.extensionSettingsPanel);
    if (!panel) return <SettingsPlaceholder message="Extension settings panel not found." />;

    return (
      <ExtensionWebviewFrame
        extensionId={panel.extensionId}
        extensionInstanceId={panel.extensionInstanceId}
        installName={panel.installName}
        projectId={projectId}
        title={resolveLabel(panel.title)}
        webview={resolveWebviewTitle(panel.webview)}
        webviewId={panel.id}
      />
    );
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
  const { section, projectId, projectName, repositories, ticketStatuses, attemptStatuses } = props;

  if (section === "runtime") {
    return <RuntimePanel projectId={projectId} />;
  }

  if (section === "ticket-statuses") {
    return <TicketStatusManager projectId={projectId} statuses={ticketStatuses} />;
  }

  if (section === "attempt-statuses") {
    return <AttemptStatusManager projectId={projectId} statuses={attemptStatuses} />;
  }

  if (section === "extensions") {
    return <ExtensionsPanel projectId={projectId} />;
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
    extensionSettingsPanels,
    projectId,
    projectName,
    repositories,
    tags,
    ticketStatuses,
    attemptStatuses,
    onDeleteTag,
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
        extensionSettingsPanels={extensionSettingsPanels}
        projectId={projectId}
        tags={tags}
        onDeleteTag={onDeleteTag}
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
      attemptStatuses={attemptStatuses}
    />
  );
};
