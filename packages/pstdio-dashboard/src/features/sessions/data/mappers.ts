import type { Session } from "../types";

interface SessionDto {
  id: string;
  project_id: string | null;
  title: string;
  status: Session["status"];
  archived: boolean;
  agent: string | null;
  created_at: string;
  updated_at: string;
}

export const toSession = (dto: SessionDto): Session => ({
  id: dto.id,
  projectId: dto.project_id,
  title: dto.title,
  status: dto.status,
  archived: dto.archived,
  agent: dto.agent,
  createdAt: dto.created_at,
  updatedAt: dto.updated_at,
});
