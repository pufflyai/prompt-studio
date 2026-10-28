import type { OnboardingInfo, OnboardingState, UpdateOnboarding } from "pstdio-api-contracts";
import type { RequestFn } from "./request";

export const createOnboardingClient = (request: RequestFn) => ({
  read: () => request<OnboardingInfo>("/v1/onboarding"),
  update: (body: UpdateOnboarding) => request<OnboardingState>("/v1/onboarding", { method: "PATCH", body }),
});
