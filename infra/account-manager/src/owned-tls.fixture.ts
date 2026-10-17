import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const createOwnedTls = async () => {
  const directory = await mkdtemp(join(tmpdir(), "manager-tls-"));
  const cert = join(directory, "cert.pem");
  const key = join(directory, "key.pem");
  const command = Bun.spawn(
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
  const close = () => rm(directory, { recursive: true, force: true });
  if ((await command.exited) !== 0) {
    await close();
    throw new Error("Owned TLS generation failed");
  }
  return { cert, key, close };
};
