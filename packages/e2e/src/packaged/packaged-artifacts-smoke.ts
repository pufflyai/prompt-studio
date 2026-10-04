import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

export const expectPackagedArtifacts = async (input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
  metadata: WorkbenchExtensionMetadata;
}) => {
  const { baseUrl, projectId, headers, metadata } = input;
  const appearanceRes = await fetch(`${baseUrl}/v1/projects/${projectId}/extensions/appearance`, {
    headers,
  });
  expect(appearanceRes.status).toBe(200);
  const appearance = await appearanceRes.json();
  expect(appearance.translations).toContainEqual(
    expect.objectContaining({
      extensionId: "pstdio.pstdio-artifacts",
      bundles: expect.objectContaining({ fr: expect.any(Object) }),
    }),
  );
  expect(metadata.pages).toContainEqual(
    expect.objectContaining({
      extensionId: "pstdio.pstdio-artifacts",
      localId: "artifacts",
      main: { kind: "panels", empty: expect.any(Object) },
    }),
  );
  expect(metadata.views).toContainEqual(
    expect.objectContaining({ extensionId: "pstdio.pstdio-artifacts", localId: "open-artifact" }),
  );
  const skillsRes = await fetch(`${baseUrl}/v1/projects/${projectId}/skills`, {
    headers,
  });
  const skills = await skillsRes.json();
  expect(skills).toContainEqual(
    expect.objectContaining({
      name: "publish-artifact",
      files: expect.arrayContaining([expect.objectContaining({ path: "SKILL.md" })]),
    }),
  );
  const policyUrl = `${baseUrl}/v1/projects/${projectId}/extensions/commands/pstdio.pstdio-skills.command.refinement-policy/execute`;
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
  const skillsExtension = extensions.find(
    (extension: { installName: string }) => extension.installName === "pstdio-skills",
  );
  expect(skillsExtension).toBeDefined();
  const settingUrl = `${baseUrl}/v1/projects/${projectId}/extensions/${skillsExtension.id}/settings/refinement.generateArtifactPrototype`;
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
