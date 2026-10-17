import { strict as assert } from "node:assert";
import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { chmod } from "node:fs/promises";
import { validFixtureTls } from "./tls-validity";

if (process.argv.includes("--check")) {
  try {
    const pairs = [
      { host: "authority", certificate: "/tls-public/authority-cert.pem", key: "/tls-private/authority-key.pem" },
      { host: "relay", certificate: "/tls-public/relay-cert.pem", key: "/relay-tls-private/relay-key.pem" },
    ].map(({ host, certificate, key }) => ({
      host,
      certificate: readFileSync(certificate, "utf8"),
      key: readFileSync(key, "utf8"),
    }));
    process.exit(validFixtureTls(pairs) ? 0 : 1);
  } catch {
    process.exit(1);
  }
}

const cert = "/tls-public/authority-cert.pem";
const child = Bun.spawn(
  [
    "openssl",
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    "/tls-private/authority-key.pem",
    "-out",
    cert,
    "-days",
    "2",
    "-subj",
    "/CN=authority",
    "-addext",
    "subjectAltName=DNS:authority",
  ],
  { stdout: "ignore", stderr: "ignore" },
);
assert.equal(await child.exited, 0, "Run-owned TLS generation must succeed");
const certificate = new X509Certificate(await Bun.file(cert).text());
assert.equal(certificate.checkHost("authority"), "authority");
assert.ok(Date.parse(certificate.validFrom) <= Date.now() && Date.now() < Date.parse(certificate.validTo));
console.log(`Generated run-owned HTTPS trust: ${certificate.fingerprint256}; valid from ${certificate.validFrom}`);

const relay = Bun.spawn(
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
    "/relay-tls-private/relay-key.pem",
    "-out",
    "/tls-public/relay-cert.pem",
    "-subj",
    "/CN=relay",
    "-addext",
    "subjectAltName=DNS:relay",
  ],
  { stdout: "inherit", stderr: "inherit" },
);
if ((await relay.exited) !== 0) throw new Error("Owned relay TLS generation failed");
await chmod("/relay-tls-private/relay-key.pem", 0o600);
await Bun.write(
  "/tls-public/trust.pem",
  `${await Bun.file("/tls-public/authority-cert.pem").text()}${await Bun.file("/tls-public/relay-cert.pem").text()}`,
);
