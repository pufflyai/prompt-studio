import { apiRequest } from "@/lib/api";

export const stopSession = async (sessionId: string) => {
  await apiRequest(`/v1/sessions/${sessionId}/status`, {
    method: "PATCH",
    body: { status: "cancelled" },
  });
};
