/**
 * Desktop opens a created project in its own workbench, so the workbench that created it hands
 * the project's setup to the workbench that shows it.
 */
export const createProjectSetupHandoff = () => {
  const pending = new Set<string>();
  return {
    hand: (projectId: string) => {
      pending.add(projectId);
    },
    take: (projectId: string | undefined) => (projectId ? pending.delete(projectId) : false),
  };
};

export type ProjectSetupHandoff = ReturnType<typeof createProjectSetupHandoff>;
