import { strict as assert } from "node:assert";
import { X509Certificate } from "node:crypto";

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
