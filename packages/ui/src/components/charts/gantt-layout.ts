export interface GanttTask {
  id: string;
  label: string;
  start: number;
  end: number;
  group?: string;
  progress?: number;
  dependsOn?: readonly string[];
}

export interface GanttRow extends GanttTask {
  lane: string;
  kind: "group" | "task" | "milestone";
  progress: number;
}

export function ganttLayout(tasks: readonly GanttTask[]) {
  const rows: GanttRow[] = [];
  for (const group of new Set(tasks.map((task) => task.group))) {
    const children = tasks.filter((task) => task.group === group);
    if (group) {
      const duration = children.reduce((sum, task) => sum + task.end - task.start, 0);
      const completed = children.reduce((sum, task) => sum + (task.end - task.start) * (task.progress ?? 0), 0);
      rows.push({
        id: `group:${group}`,
        lane: `group:${group}`,
        label: group,
        group,
        start: Math.min(...children.map((task) => task.start)),
        end: Math.max(...children.map((task) => task.end)),
        progress: duration ? completed / duration : 0,
        kind: "group",
      });
    }
    rows.push(
      ...children.map((task) => ({
        ...task,
        lane: `task:${task.id}`,
        progress: task.progress ?? 0,
        kind: task.start === task.end ? ("milestone" as const) : ("task" as const),
      })),
    );
  }
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
