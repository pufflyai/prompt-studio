import { Button, Flex, Menu } from "@chakra-ui/react";
import { ItemSection, MenuItem, PanelMenu } from "@pstdio/ui";
import { FileText, Plus, Tag } from "lucide-react";
import type { ProjectTemplateAsset } from "@/features/project/types";

export type SettingsSection = "tags" | "danger-zone" | { template: string };

interface SettingsSidebarProps {
  templates: ProjectTemplateAsset[];
  activeSection: SettingsSection | null;
  onSelectSection: (section: SettingsSection) => void;
  onCreateTemplate: () => void;
}

const isTemplateSelected = (activeSection: SettingsSection | null, templateName: string) => {
  if (!activeSection || typeof activeSection === "string") return false;
  return activeSection.template === templateName;
};

export const SettingsSidebar = (props: SettingsSidebarProps) => {
  const { templates, activeSection, onSelectSection, onCreateTemplate } = props;

  return (
    <PanelMenu title="Settings" variant="compact">
      <Menu.Root>
        <MenuItem
          primaryLabel="Tags"
          leftIcon={Tag}
          isSelected={activeSection === "tags"}
          variant="compact"
          onClick={() => onSelectSection("tags")}
        />
      </Menu.Root>

      <ItemSection
        title="Templates"
        defaultOpen
        action={
          <Button size="2xs" variant="ghost" onClick={onCreateTemplate} aria-label="Create template">
            <Plus size={14} />
          </Button>
        }
      >
        {templates.map((template) => (
          <Menu.Root key={template.id}>
            <MenuItem
              primaryLabel={template.name}
              leftIcon={FileText}
              isSelected={isTemplateSelected(activeSection, template.name)}
              variant="compact"
              tagLabel={template.isDefault ? "default" : undefined}
              onClick={() => onSelectSection({ template: template.name })}
            />
          </Menu.Root>
        ))}
      </ItemSection>

      <Flex borderTopWidth="1px" mt="auto" pt="xs">
        <Menu.Root>
          <MenuItem
            primaryLabel="Danger zone"
            isSelected={activeSection === "danger-zone"}
            variant="compact"
            onClick={() => onSelectSection("danger-zone")}
          />
        </Menu.Root>
      </Flex>
    </PanelMenu>
  );
};
