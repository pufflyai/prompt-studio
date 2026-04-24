export type CreateProjectRepositoryInput = {
  path: string;
  displayName: string | null;
};

export type CreateProjectInput = {
  name: string;
  repositories: CreateProjectRepositoryInput[];
  agents: string[];
};
