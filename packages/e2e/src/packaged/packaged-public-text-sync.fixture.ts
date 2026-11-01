import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { writePublicTextExtensions } from "../helpers/public-text-extension";
import { startPublicTextPeer } from "./packaged-public-text-peer.fixture";
import { runtimeAuthorization, startPackagedServe } from "./packaged-serve-helpers";

/** Independent compiled hosts use their normal encrypted account-sync transport. */
export const publicTextSyncFixture = async (root: string) => {
  const key = join(root, "peer-key.pem");
  const cert = join(root, "peer-cert.pem");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      cert,
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=IP:127.0.0.1,DNS:localhost",
    ],
    { stdio: "ignore" },
  );
  const sources = writePublicTextExtensions(root);
  const peer = await startPublicTextPeer(root);
  const env = {
    NODE_EXTRA_CA_CERTS: cert,
    PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({
      defaultExtensions: [
        { source: sources.editor, installName: "public-text-editor" },
        { source: sources.source, installName: "public-text-source" },
      ],
    }),
  };
  const startDevice = async (name: string) => {
    const home = join(root, name);
    mkdirSync(home, { recursive: true });
    const host = await startPackagedServe(home, env);
    const client = createClient({ baseUrl: host.baseUrl, token: host.descriptor.token });
    return { home, host, client };
  };
  return { peer, startDevice };
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
