import { readFile, writeFile } from "node:fs/promises";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { AccessError } from "./config";
import type { VerifiedIdentity } from "./identity";

export async function loadStorageSigningKey(path: string) {
  try {
    await writeFile(path, crypto.getRandomValues(new Uint8Array(32)), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const bytes = await readFile(path);
  if (bytes.length !== 32) throw new Error("Invalid storage signing key.");
  return bytes;
}

type StorageAuthority = { principalId: string; roles: readonly string[]; storageDeadline: number };
type AuthorizeStorage = (identity: VerifiedIdentity, runId?: string) => Promise<StorageAuthority>;
const inputSchema = z.strictObject({
  method: z.enum(["GET", "PUT"]),
  object: z.string().regex(/^(sources\/[0-9a-f-]{36}\.tar\.gz|logs\/[0-9a-f-]{36}\.log)$/i),
  expiresSeconds: z.number().int().positive().max(86400),
});

export function createStorageAccess(options: {
  issuer: string;
  key: Uint8Array;
  sign: (input: { method: "GET" | "PUT"; object: string; expiresSeconds: number }) => Promise<string>;
}) {
  return {
    async issue(identity: VerifiedIdentity, runId: string | undefined, expiresAt: string) {
      return new SignJWT({ identity, runId })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer(options.issuer)
        .setAudience("cloud-run-storage")
        .setSubject(identity.subject)
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.parse(expiresAt) / 1000))
        .sign(options.key);
    },
    async handle(request: Request, authorize: AuthorizeStorage) {
      let identity: VerifiedIdentity;
      let runId: string | undefined;
      try {
        const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
        const { payload } = await jwtVerify(token, options.key, {
          issuer: options.issuer,
          audience: "cloud-run-storage",
          algorithms: ["HS256"],
          requiredClaims: ["exp", "sub"],
        });
        identity = payload.identity as VerifiedIdentity;
        runId = payload.runId as string | undefined;
      } catch {
        throw new AccessError(401, "Cloud storage enrollment is invalid or expired.");
      }
      const authority = await authorize(identity, runId);
      if (!authority.roles.includes("runner")) throw new AccessError(403, "Run storage access is not granted.");
      if (new URL(request.url).pathname === "/v1/storage/check") return { ok: true };
      const input = inputSchema.parse(await request.json());
      const expiresSeconds = Math.min(
        input.expiresSeconds,
        Math.floor((authority.storageDeadline - Date.now()) / 1000),
      );
      if (expiresSeconds <= 0) throw new AccessError(403, "Run storage authorization has ended.");
      const object = `owners/${authority.principalId}/${input.object}`;
      const expiresAt = Date.now() + expiresSeconds * 1000;
      const url = await options.sign({ method: input.method, object, expiresSeconds });
      // Signing calls IAM asynchronously. A revoked or narrowed grant must not receive a fresh URL.
      const current = await authorize(identity, runId);
      if (
        current.principalId !== authority.principalId ||
        !current.roles.includes("runner") ||
        current.storageDeadline < expiresAt ||
        Date.now() >= expiresAt
      )
        throw new AccessError(403, "Run storage authorization has changed.");
      return { url, expiresAt: new Date(expiresAt).toISOString() };
    },
  };
}
export type StorageAccess = ReturnType<typeof createStorageAccess>;
