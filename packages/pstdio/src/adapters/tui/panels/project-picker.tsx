import { Box, Text } from "ink";

interface Project {
  id: string;
  name: string;
}

interface ProjectPickerProps {
  projects: Project[];
  currentProjectId: string | null;
  selectedIndex: number;
  width: number;
  viewportHeight: number;
}

export function ProjectPicker({
  projects,
  currentProjectId,
  selectedIndex,
  width,
  viewportHeight,
}: ProjectPickerProps) {
  if (projects.length === 0) {
    const topPad = Math.max(0, Math.floor(viewportHeight / 2) - 1);

    return (
      <Box flexDirection="column" height={viewportHeight} width={width}>
        <Box height={topPad} />
        <Box justifyContent="center">
          <Text dimColor>Loading projects...</Text>
        </Box>
      </Box>
    );
  }

  const contentLines = projects.length + 4;
  const topPad = Math.max(0, Math.floor((viewportHeight - contentLines) / 2));
  const bottomPad = Math.max(0, viewportHeight - contentLines - topPad);

  return (
    <Box flexDirection="column" height={viewportHeight} width={width}>
      <Box height={topPad} />

      <Box justifyContent="center">
        <Text bold> Switch Project </Text>
      </Box>

      <Text> </Text>

      {projects.map((project, i) => {
        const isSelected = i === selectedIndex;
        const isCurrent = project.id === currentProjectId;

        return (
          <Text key={project.id}>
            <Text color={isSelected ? "blue" : undefined}>{isSelected ? " ❯ " : "   "}</Text>
            <Text
              bold={isSelected}
              color={isSelected ? "blue" : undefined}
              backgroundColor={isSelected ? "gray" : undefined}
            >
              {project.name}
            </Text>
            {isCurrent && <Text color="green"> (current)</Text>}
          </Text>
        );
      })}

      <Text> </Text>

      <Box justifyContent="center">
        <Text dimColor>enter select · esc cancel</Text>
      </Box>

      <Box height={bottomPad} />
    </Box>
  );
}
