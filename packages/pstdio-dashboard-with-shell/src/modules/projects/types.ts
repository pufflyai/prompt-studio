export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRepositoryInput {
  path: string;
  displayName: string | null;
}

export interface CreateProjectInput {
  name: string;
  repositories: CreateProjectRepositoryInput[];
  agents: string[];
}
