import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveCredentialMounts, writeExtraCaContext } from "./isolated-host-files";

const roots: string[] = [];
const temporaryRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "isolated-host-files-"));
  roots.push(root);
  return root;
};
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const certificate = (name: string) => `-----BEGIN CERTIFICATE-----\n${name}\n-----END CERTIFICATE-----`;

describe("agent credential mounts", () => {
  test("mounts only the agent login files that exist on the host", () => {
    const home = temporaryRoot();
    mkdirSync(join(home, ".codex"));
    writeFileSync(join(home, ".codex", "auth.json"), "{}");

    const mounts = resolveCredentialMounts(home);

    expect(mounts.mounted).toEqual([
      { source: join(home, ".codex", "auth.json"), target: "/home/bun/.codex/auth.json" },
    ]);
    expect(mounts.missing).toEqual([
      join(home, ".local", "share", "opencode", "auth.json"),
      join(home, ".local", "share", "opencode", "mcp-auth.json"),
    ]);
  });
});

describe("extra CA build context", () => {
  test("writes each certificate of a PEM bundle to its own file", () => {
    const root = temporaryRoot();
    const bundle = join(root, "managed-ca.pem");
    writeFileSync(bundle, `${certificate("first")}\n${certificate("second")}\n`);
    const context = join(root, "extra-ca");

    writeExtraCaContext(context, bundle);

    expect(readdirSync(context).sort()).toEqual(["extra-ca-1.crt", "extra-ca-2.crt"]);
    expect(readFileSync(join(context, "extra-ca-2.crt"), "utf8")).toBe(`${certificate("second")}\n`);
  });

  test("leaves the context empty when no CA file is configured", () => {
    const root = temporaryRoot();
    const context = join(root, "extra-ca");
    mkdirSync(context);
    writeFileSync(join(context, "extra-ca-1.crt"), certificate("old"));

    writeExtraCaContext(context, undefined);

    expect(readdirSync(context)).toEqual([]);
  });

  test("rejects a configured CA file without a PEM certificate", () => {
    const root = temporaryRoot();
    const file = join(root, "empty.pem");
    writeFileSync(file, "");

    expect(() => writeExtraCaContext(join(root, "extra-ca"), file)).toThrow("contains no PEM certificate");
  });
});
