import { Button, Container, IconButton, Stack, Text } from "@chakra-ui/react";
import { Folder, Plus, Settings } from "lucide-react";

import { ListRow } from "../../list-row/list-row";
import { type MockProject, mockProjects } from "../mock-data";

interface ProjectListPageProps {
  onSelectProject: (project: MockProject) => void;
  onOpenSettings: () => void;
}

export const ProjectListPage = (props: ProjectListPageProps) => {
  const { onSelectProject, onOpenSettings } = props;

  return (
    <Container maxW="3xl" py="lg">
      <Stack gap="lg">
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack gap="2xs">
            <Text textStyle="heading/M">Projects</Text>
            <Text textStyle="paragraph/S/regular" color="fg.muted">
              {mockProjects.length} projects
            </Text>
          </Stack>
          <Stack direction="row" gap="xs">
            <IconButton size="sm" variant="ghost" aria-label="Open settings" onClick={onOpenSettings}>
              <Settings size={18} />
            </IconButton>
            <Button size="sm" variant="primary">
              <Plus size={14} />
              New project
            </Button>
          </Stack>
        </Stack>

        <Stack gap="xs">
          {mockProjects.map((project) => (
            <ListRow
              key={project.id}
              variant="compact"
              id={project.id}
              label={project.name}
              description={project.repoPath}
              icon={<Folder size={14} />}
              onActivate={() => onSelectProject(project)}
            />
          ))}
        </Stack>
      </Stack>
    </Container>
  );
};
