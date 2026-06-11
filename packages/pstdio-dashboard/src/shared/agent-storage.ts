/** Namespaced harness id (e.g. "pstdio.harness-open-code.opencode"). */
export type CodingAgent = string;

const ONBOARDING_KEY = "onboarding-complete";
const AGENT_KEY = "selected-agent";

export const isOnboardingComplete = () => {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
};

export const setOnboardingComplete = () => {
  localStorage.setItem(ONBOARDING_KEY, "true");
};

export const getStoredAgent = (): CodingAgent | null => {
  return localStorage.getItem(AGENT_KEY) as CodingAgent | null;
};

export const setStoredAgent = (agent: CodingAgent) => {
  localStorage.setItem(AGENT_KEY, agent);
};
