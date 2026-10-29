import { expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const expectPackagedOnboarding = async (baseUrl: string, headers: Record<string, string>) => {
  const update = (body: unknown) =>
    fetch(`${baseUrl}/v1/onboarding`, {
      method: "PATCH",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const hidden = await update({ step: "visibility", hidden: true });
  expect(hidden.status).toBe(200);
  expect(await hidden.json()).toMatchObject({ hidden: true, completed: false });
  const skipped = await update({ step: "skip" });
  expect(skipped.status).toBe(200);
  expect(await skipped.json()).toMatchObject({ completed: true, harnesses: null, workAreas: null });
  const saved = await fetch(`${baseUrl}/v1/onboarding`, { headers });
  expect(saved.status).toBe(200);
  expect((await saved.json()).state).toMatchObject({ hidden: true, completed: true });
  const jobs = await fetch(`${baseUrl}/v1/extension-installations`, { headers });
  expect(jobs.status).toBe(200);
  expect(Array.isArray(await jobs.json())).toBe(true);
};

export const writePackagedOnboardingSources = (root: string) => {
  for (const name of ["harness-codex", "pstdio-planner", "pstdio-base-themes", "pstdio-skills"]) {
    const source = join(root, "extensions", name);
    mkdirSync(source, { recursive: true });
    writeFileSync(
      join(source, "package.json"),
      JSON.stringify({
        name,
        publisher: "pstdio",
        version: "1.0.0",
        main: "./extension.ts",
        engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      }),
    );
    writeFileSync(join(source, "extension.ts"), "export default {};\n");
  }
};

export const expectPackagedProjectChoices = async (
  baseUrl: string,
  headers: Record<string, string>,
  projectId: string,
  peerId: string,
) => {
  const extensions = async (id: string) =>
    (await (await fetch(`${baseUrl}/v1/projects/${id}/extensions`, { headers })).json()).extensions as {
      extensionId: string;
      enabled: boolean;
    }[];
  const enabled = async (id: string, extensionId: string) =>
    (await extensions(id)).find((entry) => entry.extensionId === extensionId)?.enabled;
  for (const id of [projectId, peerId]) {
    expect(await enabled(id, "pstdio.harness-codex")).toBe(false);
    expect(await enabled(id, "pstdio.pstdio-planner")).toBe(false);
  }
  const info = await (await fetch(`${baseUrl}/v1/onboarding`, { headers })).json();
  expect(info.installedExtensions).toContain("pstdio.harness-codex");
  const harness = await fetch(`${baseUrl}/v1/onboarding?project_id=${projectId}`, {
    method: "PATCH",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ step: "harnesses", harnesses: ["codex"] }),
  });
  expect(harness.status).toBe(200);
  while (!(await enabled(projectId, "pstdio.harness-codex"))) await Bun.sleep(25);
  expect(await enabled(peerId, "pstdio.harness-codex")).toBe(false);
  const empty = await fetch(`${baseUrl}/v1/onboarding?project_id=${peerId}`, {
    method: "PATCH",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ step: "complete", workAreas: [] }),
  });
  expect(empty.status).toBe(200);
  while (!(await enabled(peerId, "pstdio.pstdio-skills"))) await Bun.sleep(25);
  expect(await enabled(peerId, "pstdio.pstdio-planner")).toBe(false);
};
