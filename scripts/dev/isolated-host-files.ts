import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Agent logins the container may reuse. Docker Desktop creates a missing bind source as an empty
// directory on the host, which then blocks a later `codex login` or `opencode auth login`. So only
// files that exist are mounted; a missing login means that agent must sign in inside the stack.
const CREDENTIAL_FILES = [
  { host: [".codex", "auth.json"], target: "/home/bun/.codex/auth.json" },
  { host: [".local", "share", "opencode", "auth.json"], target: "/home/bun/.local/share/opencode/auth.json" },
  { host: [".local", "share", "opencode", "mcp-auth.json"], target: "/home/bun/.local/share/opencode/mcp-auth.json" },
];

export const resolveCredentialMounts = (home: string) => {
  const files = CREDENTIAL_FILES.map(({ host, target }) => ({ source: join(home, ...host), target }));
  return {
    mounted: files.filter(({ source }) => existsSync(source)),
    missing: files.filter(({ source }) => !existsSync(source)).map(({ source }) => source),
  };
};

export const writeCredentialComposeFile = (path: string, mounts: Array<{ source: string; target: string }>) => {
  const volumes = mounts.map(({ source, target }) => ({ type: "bind", source, target }));
  writeFileSync(path, `${JSON.stringify({ services: { "prompt-studio": { volumes } } }, null, 2)}\n`);
};

// The image trusts every certificate in this build context, for networks whose proxy re-signs TLS.
// Debian's update-ca-certificates skips files with more than one certificate, so a bundle is split.
export const writeExtraCaContext = (directory: string, caFile: string | undefined) => {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  if (!caFile) return 0;
  const certificates = readFileSync(caFile, "utf8").match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
  );
  if (!certificates) throw new Error(`NODE_EXTRA_CA_CERTS points to ${caFile}, which contains no PEM certificate.`);
  certificates.forEach((certificate, index) => {
    writeFileSync(join(directory, `extra-ca-${index + 1}.crt`), `${certificate}\n`);
  });
  return certificates.length;
};
