import { expect } from "bun:test";
import { runPackagedAsync } from "./packaged-helpers";

export const expectPackagedProjectComposition = async (input: {
  projectId: string;
  projectFolder: string;
  baseUrl: string;
  headers: Record<string, string>;
}) => {
  const { projectId, projectFolder, baseUrl, headers } = input;
  const env = { PSTDIO_API_URL: baseUrl, PSTDIO_API_TOKEN: headers.authorization!.replace(/^Bearer /, "") };
  const command = ["projects", "composition", "--project-id", projectId];
  const original = JSON.parse(await runPackagedAsync(command, projectFolder, env));
  const choice = {
    defaultPage: { kind: "page", extensionId: "example.space", id: "desk" },
    resourceOpeners: [
      {
        resourceKind: { kind: "resource-kind", extensionId: "pstdio", id: "workspace" },
        opener: { kind: "command", extensionId: "example.reader", id: "inspect" },
      },
    ],
  };
  const url = `${baseUrl}/v1/projects/${projectId}/composition`;
  try {
    expect(
      JSON.parse(await runPackagedAsync([...command, "--value", JSON.stringify(choice)], projectFolder, env)),
    ).toEqual(choice);
    expect(await (await fetch(url, { headers })).json()).toEqual(choice);
    expect(JSON.parse(await runPackagedAsync(command, projectFolder, env))).toEqual(choice);
  } finally {
    const restored = await fetch(url, {
      method: "PUT",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify(original),
    });
    expect(restored.status).toBe(200);
  }
};
