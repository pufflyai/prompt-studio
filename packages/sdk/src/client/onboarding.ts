import type { OnboardingInfo, OnboardingState, UpdateOnboarding } from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export const createOnboardingClient = (request: RequestFn) => ({
  read: () => request<OnboardingInfo>("/v1/onboarding"),
  update: (body: UpdateOnboarding, projectId?: string) =>
    request<OnboardingState>(
      projectId ? `/v1/onboarding?project_id=${encodeURIComponent(projectId)}` : "/v1/onboarding",
      { method: "PATCH", body },
    ),
});
