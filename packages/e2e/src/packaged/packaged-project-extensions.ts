import { type RuntimeDescriptor, runtimeAuthorization } from "./packaged-serve-helpers";

export const enablePackagedProjectExtension = async (
  runtime: { baseUrl: string; descriptor: RuntimeDescriptor },
  projectId: string,
  installName: string,
) => {
  const path = `${runtime.baseUrl}/v1/projects/${projectId}/extensions`;
  const headers = runtimeAuthorization(runtime.descriptor);
  const listed = await fetch(path, { headers });
  if (!listed.ok) throw new Error(`Extension listing failed with HTTP ${listed.status}`);
  const { extensions } = (await listed.json()) as { extensions: { id: string; installName: string }[] };
  const instance = extensions.find((entry) => entry.installName === installName);
  if (!instance) throw new Error(`Project extension not found: ${installName}`);
  const enabled = await fetch(`${path}/${instance.id}`, {
    method: "PATCH",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ enabled: true }),
  });
  if (!enabled.ok) throw new Error(`Extension enablement failed with HTTP ${enabled.status}`);
};
