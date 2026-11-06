import { Stack } from "@chakra-ui/react";
import { useState } from "react";
import { GanttChart } from "./gantt-chart";
import { galleryMilestones, galleryTasks } from "./visualization-data";
export const GanttDemo = () => {
  const [selectedId, setSelectedId] = useState<string>();
  return (
    <Stack w="full">
      <GanttChart
        tasks={galleryTasks}
        milestones={galleryMilestones}
        ariaLabel="Project forecast with dependencies"
        formatValue={(value) => `${value}h`}
        now={0}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </Stack>
  );
};
