import { HStack, Stack, Text } from "@chakra-ui/react";

import { Header } from "../../header";
import { ListRow } from "../../list-row/list-row";
import { Switch } from "../../switch";

interface SettingsPageProps {
  scope: "global" | "project";
}

const globalSections = [
  { id: "agents", label: "Agents", description: "Configure available coding agents." },
  { id: "appearance", label: "Appearance", description: "Theme and density." },
  { id: "shortcuts", label: "Shortcuts", description: "Keyboard bindings." },
];

const projectSections = [
  { id: "templates", label: "Templates", description: "Ticket scaffolds." },
  { id: "skills", label: "Skills", description: "Reusable agent prompts." },
  { id: "statuses", label: "Statuses", description: "Workflow stages." },
  { id: "tags", label: "Tags", description: "Labels and metadata." },
];

const placeholderToggles = [
  { id: "auto-save", label: "Auto-save changes", on: true },
  { id: "diff-preview", label: "Show inline diff preview", on: false },
  { id: "experimental", label: "Enable experimental features", on: false },
];

export const SettingsPage = (props: SettingsPageProps) => {
  const { scope } = props;
  const sections = scope === "global" ? globalSections : projectSections;

  return (
    <HStack flex="1" minH="0" gap="0" align="stretch">
      <Stack gap="0" width="240px" borderRightWidth="1px" borderColor="border.muted" minH="0">
        <Header variant="narrow" borderBottomWidth="1px" borderColor="border.muted" bg="bg">
          <Text textStyle="label/S/medium">Sections</Text>
        </Header>
        <Stack flex="1" minH="0" overflowY="auto" gap="0">
          {sections.map((section, index) => (
            <ListRow
              key={section.id}
              variant="compact"
              isSelected={index === 0}
              id={section.id}
              label={section.label}
              description={section.description}
            />
          ))}
        </Stack>
      </Stack>

      <Stack flex="1" minW="0" gap="0">
        <Header variant="narrow" borderBottomWidth="1px" borderColor="border.muted" bg="bg">
          <Text textStyle="label/S/medium">{sections[0]?.label}</Text>
        </Header>
        <Stack flex="1" minH="0" overflowY="auto" p="lg" gap="md" maxW="3xl">
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {sections[0]?.description}
          </Text>
          <Stack gap="sm" borderWidth="1px" borderColor="border.muted" borderRadius="md" p="md">
            {placeholderToggles.map((toggle) => (
              <HStack key={toggle.id} justifyContent="space-between">
                <Text textStyle="label/M/regular">{toggle.label}</Text>
                <Switch defaultChecked={toggle.on} />
              </HStack>
            ))}
          </Stack>
        </Stack>
      </Stack>
    </HStack>
  );
};
