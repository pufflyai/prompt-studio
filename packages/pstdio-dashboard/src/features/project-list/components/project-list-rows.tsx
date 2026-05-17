import { Box, Icon, Input, InputGroup, Stack, Text } from "@chakra-ui/react";
import { EmptyState, Header, ListRow, ScrollArea } from "@pstdio/ui";
import { Folder, Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ProjectListItem } from "../types";

const searchInputBorderProps = {
  borderColor: "border.muted",
  boxShadow: "none",
  outline: "none",
} as const;

interface ProjectSearchableListProps {
  projects: ProjectListItem[];
  isLoading: boolean;
  searchTerm: string;
  isCreateProjectDisabled: boolean;
  onSearchTermChange: (value: string) => void;
  onCreateProject: () => void;
  onSelectProject: (project: ProjectListItem) => void;
}

interface ProjectListRowsProps {
  projects: ProjectListItem[];
  isLoading: boolean;
  searchTerm: string;
  leadingRow?: React.ReactNode;
  renderRow: (project: ProjectListItem) => React.ReactNode;
}

export const ProjectListRows = (props: ProjectListRowsProps) => {
  const { projects, isLoading, searchTerm, leadingRow, renderRow } = props;
  const { t } = useTranslation("projects");

  if (isLoading) {
    return (
      <Stack gap="0">
        {leadingRow}
        <Box px="sm" py="sm">
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            {t("list.loadingProjects")}
          </Text>
        </Box>
      </Stack>
    );
  }

  if (projects.length === 0) {
    if (searchTerm.trim().length > 0) {
      return (
        <Stack gap="0">
          {leadingRow}
          <Box px="sm" py="sm">
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              {t("list.noSearchResults")}
            </Text>
          </Box>
        </Stack>
      );
    }

    return (
      <Stack gap="0">
        {leadingRow}
        <Box px="sm" py="md">
          <EmptyState title={t("list.noProjectsYet")} description={t("list.noProjectsDescription")} />
        </Box>
      </Stack>
    );
  }

  return (
    <Stack gap="0">
      {leadingRow}
      {projects.map((project) => (
        <Box key={project.id}>{renderRow(project)}</Box>
      ))}
    </Stack>
  );
};

interface ProjectRowProps {
  project: ProjectListItem;
  onSelect?: () => void;
}

export const ProjectRow = (props: ProjectRowProps) => {
  const { project, onSelect } = props;
  const { t } = useTranslation("projects");

  return (
    <ListRow
      variant="compact"
      id={project.id}
      label={project.name}
      description={project.repoPath ?? t("chatInput.repo.noneLinked")}
      icon={<Icon as={Folder} boxSize="16px" />}
      onActivate={onSelect}
    />
  );
};

interface CreateProjectRowProps {
  isDisabled: boolean;
  onCreateProject: () => void;
}

export const CreateProjectRow = (props: CreateProjectRowProps) => {
  const { isDisabled, onCreateProject } = props;
  const { t } = useTranslation("projects");

  return (
    <ListRow
      variant="compact"
      id="create-project"
      label={t("list.createProject")}
      icon={<Icon as={Plus} boxSize="16px" />}
      disabled={isDisabled}
      onActivate={onCreateProject}
    />
  );
};

export const ProjectSearchableList = (props: ProjectSearchableListProps) => {
  const {
    projects,
    isLoading,
    searchTerm,
    isCreateProjectDisabled,
    onSearchTermChange,
    onCreateProject,
    onSelectProject,
  } = props;
  const { t } = useTranslation("projects");

  return (
    <Box borderWidth="1px" borderColor="border.muted" borderRadius="md" overflow="hidden">
      <Header as="div" variant="input" borderBottomWidth="1px" borderColor="border.muted" flexShrink={0}>
        <InputGroup startElement={<Search size={14} />} width="full">
          <Input
            borderWidth="0"
            borderRadius="0"
            height="full"
            value={searchTerm}
            placeholder={t("list.searchPlaceholder")}
            aria-label={t("list.searchPlaceholder")}
            autoComplete="off"
            autoFocus
            _hover={searchInputBorderProps}
            _active={searchInputBorderProps}
            _focus={searchInputBorderProps}
            _focusVisible={searchInputBorderProps}
            onChange={(event) => onSearchTermChange(event.target.value)}
          />
        </InputGroup>
      </Header>
      <ScrollArea maxH="22rem" viewportProps={{ overscrollBehavior: "contain" }} p="0" gap="0">
        <ProjectListRows
          projects={projects}
          isLoading={isLoading}
          searchTerm={searchTerm}
          leadingRow={<CreateProjectRow isDisabled={isCreateProjectDisabled} onCreateProject={onCreateProject} />}
          renderRow={(project) => <ProjectRow project={project} onSelect={() => onSelectProject(project)} />}
        />
      </ScrollArea>
    </Box>
  );
};
