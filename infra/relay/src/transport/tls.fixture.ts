import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const createFixtureTls = async () => {
  const root = await mkdtemp(join(tmpdir(), "relay-authority-tls-"));
  const cert = join(root, "cert.pem");
  const key = join(root, "key.pem");
  const child = Bun.spawn(
    [
      "openssl",
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
      "2",
      "-subj",
      "/CN=127.0.0.1",
      "-addext",
      "subjectAltName=IP:127.0.0.1",
    ],
    { stdout: "ignore", stderr: "ignore" },
  );
  const close = () => rm(root, { recursive: true, force: true });
  if ((await child.exited) !== 0) {
    await close();
    throw new Error("Could not create owned fixture TLS");
  }
  return { config: { cert: Bun.file(cert), key: Bun.file(key) }, cert, close };
};
