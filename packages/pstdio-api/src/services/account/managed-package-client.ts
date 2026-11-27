import { serviceUrl } from "pstdio-sync/relay";
import { accountScopedPath, managedPackageMaxBytes } from "pstdio-sync-contracts";
import { AccountRequestError } from "./account-errors";
import { managerWorkbenchesSchema } from "./manager-account";
import { ManagerRequestDenied } from "./manager-client";
import type { createNativeManagerCall } from "./native-manager-call";
import type { DeviceLogin } from "./native-store";

export const readManagedProjectGrant = async (input: {
  call: ReturnType<typeof createNativeManagerCall>;
  login: DeviceLogin;
  accountId: string;
  projectId: string;
  signal?: AbortSignal;
}) => {
  const { call, login, accountId, projectId, signal } = input;
  const projects = managerWorkbenchesSchema.parse(
    await call(accountScopedPath("/v1/workbenches", accountId), undefined, login.token, signal, login, true),
  );
  const grantId = projects.find((row) => row.workbenchId === projectId)?.grantId;
  if (!grantId) throw new AccountRequestError("Current project access is required to install managed extensions");
  return grantId;
};

export const managedPackageRequest = async (
  login: DeviceLogin,
  path: string,
  options: { bytes?: Uint8Array; descriptor?: unknown; signal?: AbortSignal } = {},
) => {
  if (new URL(login.managerOrigin).protocol !== "https:") throw new Error("Cloud package service requires HTTPS");
  const response = await fetch(serviceUrl(login.managerOrigin, path), {
    method: options.bytes ? "POST" : "GET",
    redirect: "error",
    headers: {
      origin: new URL(login.managerOrigin).origin,
      authorization: `Bearer ${login.token}`,
      "content-type": "application/octet-stream",
      ...(options.descriptor
        ? { "x-pstdio-package": Buffer.from(JSON.stringify(options.descriptor)).toString("base64url") }
        : {}),
    },
    body: options.bytes ? new Uint8Array(options.bytes) : undefined,
    signal: AbortSignal.any([AbortSignal.timeout(30_000), ...(options.signal ? [options.signal] : [])]),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new ManagerRequestDenied(response.status);
  }
  return response;
};

export const readManagedPackageBytes = async (response: Response) => {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Managed package bytes are unavailable");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > managedPackageMaxBytes) {
        await reader.cancel();
        throw new Error("Managed package exceeds 64 MiB");
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
};
