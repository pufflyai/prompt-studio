import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writePublicTextExtensions } from "../helpers/public-text-extension";
import { projectSyncFixture } from "./packaged-project-sync.fixture";
import { runtimeAuthorization } from "./packaged-serve-helpers";

export const publicTextSyncFixture = (root: string) => {
  const sources = writePublicTextExtensions(root);
  return projectSyncFixture(
    root,
    JSON.stringify({
      defaultExtensions: [
        { source: sources.editor, installName: "public-text-editor" },
        { source: sources.source, installName: "public-text-source" },
      ],
    }),
  );
};

export type PublicTextDevice = Awaited<ReturnType<Awaited<ReturnType<typeof publicTextSyncFixture>>["startDevice"]>>;

/** Authentication belongs to this controlled wire peer; production Google acceptance is separate. */
export const signInPublicTextDevice = async (device: PublicTextDevice, origin: string) => {
  const login = await device.client.account.login(origin);
  const url = new URL(login.url);
  const callback = new URL(url.searchParams.get("callback")!);
  callback.searchParams.set("state", url.searchParams.get("state")!);
  callback.searchParams.set("code", "one-use");
  const response = await fetch(callback);
  if (response.status !== 200) throw new Error(`Controlled account login failed: ${response.status}`);
};

export const seedPublicTextDevice = async (device: PublicTextDevice, projectId: string) => {
  for (const owner of ["paper.public-text-source", "ink.public-text-editor"]) {
    const response = await fetch(
      `${device.host.baseUrl}/v1/projects/${projectId}/extensions/commands/${owner}.command.seed/execute`,
      {
        method: "POST",
        headers: { ...runtimeAuthorization(device.host.descriptor), "content-type": "application/json" },
        body: JSON.stringify({ params: {} }),
      },
    );
    const result = (await response.json()) as { outcome?: { ok: boolean } };
    if (!response.ok || !result.outcome?.ok) throw new Error(`Source setup failed: ${owner}`);
  }
};

export const readPublicTextCopy = (folder: string, owner: string, file: string) => {
  const path = join(folder, ".pstdio/extension-storage", owner, "documents", file);
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
};
