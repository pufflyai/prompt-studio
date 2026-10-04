import { expect } from "bun:test";

export const expectPackagedRefinement = async (input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
}) => {
  const { baseUrl, projectId, headers } = input;
  const policyUrl = `${baseUrl}/v1/projects/${projectId}/extensions/commands/pstdio.pstdio-planner.command.refinement-policy/execute`;
  const readPolicy = async () => {
    const response = await fetch(policyUrl, {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ params: {} }),
    });
    expect(response.status).toBe(200);
    return response.json();
  };
  expect(await readPolicy()).toMatchObject({
    outcome: { status: "success", value: { generateArtifactPrototype: true } },
  });
  const settingsRes = await fetch(`${baseUrl}/v1/projects/${projectId}/extensions`, { headers });
  const { extensions } = await settingsRes.json();
  const plannerExtension = extensions.find(
    (extension: { installName: string }) => extension.installName === "pstdio-planner",
  );
  expect(plannerExtension).toBeDefined();
  const settingUrl = `${baseUrl}/v1/projects/${projectId}/extensions/${plannerExtension.id}/settings/refinement.generateArtifactPrototype`;
  const disabled = await fetch(settingUrl, {
    method: "PUT",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ value: false }),
  });
  expect(disabled.status).toBe(200);
  expect(await readPolicy()).toMatchObject({
    outcome: { status: "success", value: { generateArtifactPrototype: false } },
  });
};
