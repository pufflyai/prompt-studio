export type ApiProject = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type CreateProjectRepositoryInput = {
  path: string;
  displayName: string | null;
};

export type CreateProjectInput = {
  name: string;
  repositories: CreateProjectRepositoryInput[];
};
