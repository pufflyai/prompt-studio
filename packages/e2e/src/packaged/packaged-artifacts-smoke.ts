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
};
