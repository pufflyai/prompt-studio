export interface GanttTask {
  id: string;
  label: string;
  start: number;
  end: number;
  group?: string;
  progress?: number;
  dependsOn?: readonly string[];
}

export interface GanttMilestone {
  id: string;
  label: string;
  value: number;
}

export interface GanttRow extends GanttTask {
  lane: string;
  kind: "task" | "milestone";
  progress: number;
}

export function ganttLayout(tasks: readonly GanttTask[]) {
  const rows: GanttRow[] = tasks.map((task) => ({
    ...task,
    lane: `task:${task.id}`,
    progress: task.progress ?? 0,
    kind: task.start === task.end ? "milestone" : "task",
  }));
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const dependencies = tasks.flatMap((task) =>
    (task.dependsOn ?? []).flatMap((id) => {
      const previous = byId.get(id);
      return previous
        ? [
            {
              id: `${id}:${task.id}`,
              from: previous.end,
              to: task.start,
              fromLane: `task:${id}`,
              toLane: `task:${task.id}`,
            },
          ]
        : [];
    }),
  );
  return { rows, dependencies };
}
