import { onboardingFoundationSources } from "./onboarding-sources-foundation";
import { onboardingPlatformSources } from "./onboarding-sources-platform";

export const onboardingSources = {
  ...onboardingFoundationSources,
  ...onboardingPlatformSources,
};
