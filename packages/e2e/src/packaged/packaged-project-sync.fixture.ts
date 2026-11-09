import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { createClient } from "@pstdio/sdk/client";
import { startPublicTextPeer } from "./packaged-public-text-peer.fixture";
import { startPackagedServe } from "./packaged-serve-helpers";

/** Independent compiled hosts use their normal encrypted account-sync transport. */
export const projectSyncFixture = async (root: string, defaultExtensions: string) => {
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
  const peer = await startPublicTextPeer(root);
  const env = {
    NODE_EXTRA_CA_CERTS: cert,
    PSTDIO_DEFAULT_EXTENSIONS: defaultExtensions,
  };
  const startDevice = async (name: string) => {
    const home = join(root, name);
    mkdirSync(home, { recursive: true });
    const logPath = join(import.meta.dirname, "../../test-results/packaged-runtime", `${basename(root)}-${name}.jsonl`);
    const host = await startPackagedServe(home, {
      ...env,
      PSTDIO_LOG_PATH: logPath,
      PSTDIO_LOG_LEVEL: "debug",
    });
    const client = createClient({ baseUrl: host.baseUrl, token: host.descriptor.token });
    return { home, host, client, logPath };
  };
  return { peer, startDevice };
};
