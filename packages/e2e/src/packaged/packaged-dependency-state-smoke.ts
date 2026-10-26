import { expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const expectPackagedDependencyState = async (input: {
  baseUrl: string;
  projectId: string;
  extension: { id: string; sourcePath: string };
  headers: Record<string, string>;
}) => {
  const root = `${input.baseUrl}/v1/projects/${input.projectId}/extensions`;
  const headers = { ...input.headers, "content-type": "application/json" };
  const count = async () => {
    const response = await fetch(`${root}/commands/test.dep-ext.command.count/execute`, {
      method: "POST",
      headers,
      body: JSON.stringify({ params: {} }),
    });
    expect(response.status).toBe(200);
    return response.json();
  };
  expect(await count()).toMatchObject({ outcome: { ok: true, value: 1 } });
  const unrelated = join(input.extension.sourcePath, "node_modules", "unrelated");
  mkdirSync(unrelated);
  writeFileSync(join(unrelated, "package.json"), JSON.stringify({ name: "unrelated", version: "1.0.0" }));
  for (const enabled of [false, true]) {
    const response = await fetch(`${root}/${input.extension.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ enabled }),
    });
    expect(response.status).toBe(200);
  }
  expect(await count()).toMatchObject({ outcome: { ok: true, value: 2 } });
};
