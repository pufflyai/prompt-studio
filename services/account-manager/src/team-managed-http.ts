import {
  identitySchema,
  managedExtensionIdentity,
  managedExtensionRemovalSchema,
  managedPackageMaxBytes,
  managedPackageUploadSchema,
} from "pstdio-sync-contracts";
import { z } from "zod";
import type { createManagerAuthentication } from "./manager-authentication";
import { DeviceAccessDenied } from "./renewal-errors";
import { ManagedPackageError } from "./team-managed-extensions";

const packageRequest = z.strictObject({
  workbenchId: identitySchema,
  grantId: identitySchema,
  selectionId: identitySchema,
});
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { "cache-control": "no-store" } });
const bodyBytes = async (request: Request) => {
  const reader = request.body?.getReader();
  if (!reader) throw new ManagedPackageError(400, "Package bytes are required");
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]);
  const abort = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > managedPackageMaxBytes) {
        await reader.cancel();
        throw new ManagedPackageError(400, "Managed package exceeds 64 MiB");
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
};

export const teamManagedHttp = async (
  auth: ReturnType<typeof createManagerAuthentication>,
  request: Request,
  path: string,
) => {
  const match = /^\/v1\/teams\/([^/]+)\/managed-extensions(?:\/(packages|policy)|\/([^/]+)\/(package|remove))?$/.exec(
    path,
  );
  if (!match) return null;
  const token = /^Bearer[ \t]+(\S+)[ \t]*$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) throw new DeviceAccessDenied();
  const accountId = identitySchema.parse(decodeURIComponent(match[1]));
  const service = auth.managedExtensions;
  try {
    if (request.method === "GET" && !match[2] && !match[3]) return json(await service.list(token, accountId));
    if (request.method === "GET" && match[2] === "policy") return json(await service.readPolicy(token, accountId));
    if (request.method === "POST" && match[2] === "packages") {
      const header = request.headers.get("x-pstdio-package");
      if (!header || header.length > 8192) throw new ManagedPackageError(400, "Invalid managed package descriptor");
      const descriptor = managedPackageUploadSchema.parse(JSON.parse(Buffer.from(header, "base64url").toString()));
      return json(await service.upload(token, accountId, descriptor, () => bodyBytes(request)), 201);
    }
    const extensionId = managedExtensionIdentity.parse(decodeURIComponent(match[3] ?? ""));
    if (request.method === "POST" && match[4] === "remove") {
      const { expectedSelection } = managedExtensionRemovalSchema.parse(await request.json());
      return json(await service.remove(token, accountId, extensionId, expectedSelection));
    }
    if (request.method === "GET" && match[4] === "package") {
      const input = packageRequest.parse(Object.fromEntries(new URL(request.url).searchParams));
      const result = await service.download(token, accountId, extensionId, input);
      return new Response(new Uint8Array(result.bytes), {
        headers: {
          "cache-control": "no-store",
          "content-type": "application/octet-stream",
          "x-pstdio-package": Buffer.from(JSON.stringify(result.descriptor)).toString("base64url"),
        },
      });
    }
    return null;
  } finally {
    if (!request.bodyUsed) await request.body?.cancel().catch(() => {});
  }
};
