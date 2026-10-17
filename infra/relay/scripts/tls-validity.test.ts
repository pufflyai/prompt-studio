import { expect, test } from "bun:test";
import { X509Certificate } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validFixtureTls } from "./tls-validity";

test("saved fixture TLS is reusable only while both matching host certificates remain valid", async () => {
  const root = await mkdtemp(join(tmpdir(), "relay-tls-validity-"));
  try {
    const inputs = [];
    for (const host of ["authority", "relay"]) {
      const certificate = join(root, `${host}.pem`);
      const key = join(root, `${host}.key`);
      const child = Bun.spawn(
        [
          "openssl",
          "req",
          "-x509",
          "-newkey",
          "rsa:2048",
          "-nodes",
          "-days",
          "2",
          "-keyout",
          key,
          "-out",
          certificate,
          "-subj",
          `/CN=${host}`,
          "-addext",
          `subjectAltName=DNS:${host}`,
        ],
        { stdout: "ignore", stderr: "ignore" },
      );
      expect(await child.exited).toBe(0);
      inputs.push({ host, certificate: await readFile(certificate, "utf8"), key: await readFile(key, "utf8") });
    }
    expect(validFixtureTls(inputs)).toBe(true);
    expect(validFixtureTls(inputs, Date.parse(new X509Certificate(inputs[0].certificate).validTo))).toBe(false);
    expect(validFixtureTls([{ ...inputs[0], key: inputs[1].key }, inputs[1]])).toBe(false);
    expect(validFixtureTls([{ ...inputs[0], host: "wrong-host" }, inputs[1]])).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
