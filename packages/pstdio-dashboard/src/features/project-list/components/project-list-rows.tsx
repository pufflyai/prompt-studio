import { Icon, Menu, Stack, Text } from "@chakra-ui/react";
import { EmptyState, ListRow } from "@pstdio/ui";
import { Folder } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ProjectListItem } from "../types";

interface ProjectListRowsProps {
  projects: ProjectListItem[];
  isLoading: boolean;
  searchTerm: string;
  renderRow: (project: ProjectListItem) => React.ReactNode;
}

export const ProjectListRows = (props: ProjectListRowsProps) => {
  const { projects, isLoading, searchTerm, renderRow } = props;
  const { t } = useTranslation("projects");

  if (isLoading) {
    return (
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        {t("list.loadingProjects")}
      </Text>
    );
  }

  if (projects.length === 0) {
    if (searchTerm.trim().length > 0) {
      return (
        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {t("list.noSearchResults")}
        </Text>
      );
    }

    return <EmptyState title={t("list.noProjectsYet")} description={t("list.noProjectsDescription")} />;
  }

  return (
    <Stack gap="xs">
      {projects.map((project) => (
        <Menu.Root key={project.id}>
          <Menu.Item value={project.id} asChild>
            {renderRow(project)}
          </Menu.Item>
        </Menu.Root>
      ))}
    </Stack>
  );
};

interface ProjectRowProps {
  project: ProjectListItem;
}

export const ProjectRow = (props: ProjectRowProps) => {
  const { project } = props;
  const { t } = useTranslation("projects");

  return (
    <ListRow
      asChild
      variant="compact"
      id={project.id}
      label={project.name}
      description={project.repoPath ?? t("chatInput.repo.noneLinked")}
      icon={<Icon as={Folder} boxSize="16px" />}
    />
  );
};
