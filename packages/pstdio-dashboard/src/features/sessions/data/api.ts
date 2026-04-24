import { apiRequest } from "@/lib/api";
import type { Session } from "../types";
import { type SessionDto, toSession } from "./mappers";

export const listProjectSessions = async (projectId: string): Promise<Session[]> => {
  const dtos = await apiRequest<Parameters<typeof toSession>[0][]>(`/v1/sessions?project_id=${projectId}`);
  return dtos.map(toSession);
};

export const getSession = async (sessionId: string): Promise<Session> => {
  const dto = await apiRequest<Parameters<typeof toSession>[0]>(`/v1/sessions/${sessionId}`);
  return toSession(dto);
};

export const stopSession = async (sessionId: string) =>
  apiRequest<SessionDto>(`/v1/sessions/${sessionId}/status`, {
    method: "PATCH",
    body: { status: "cancelled" },
  });
