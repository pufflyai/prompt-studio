// Workspace tests start after first-launch setup. Feature coverage can show it explicitly.
export const hideTestOnboarding = async (origin: string, headers: Record<string, string> = {}) => {
  const response = await fetch(`${origin}/v1/onboarding`, {
    method: "PATCH",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ step: "visibility", hidden: true }),
  });
  if (!response.ok) throw new Error(`Could not hide test onboarding: HTTP ${response.status}`);
};
