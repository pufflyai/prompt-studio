import { createSyncSpace, openBlob, sealBlob } from "pstdio-sync/encryption";
import {
  type ManagedPackageDescriptor,
  managedPackageDescriptorSchema,
  managedPackageMaxBytes,
} from "pstdio-sync-contracts";
import { extensionPackageMediaType } from "../../features/extensions/publication/media-type";

const digest = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
const packageSpace = (
  accountId: string,
  descriptor: Pick<ManagedPackageDescriptor, "extensionId" | "revision" | "secret">,
) =>
  createSyncSpace({
    projectId: JSON.stringify(["pstdio-managed-extension", accountId, descriptor.extensionId, descriptor.revision]),
    spaceOwner: null,
    keys: [{ generation: 1, secret: descriptor.secret }],
  });

export const sealManagedPackage = async (
  accountId: string,
  metadata: Pick<ManagedPackageDescriptor, "extensionId" | "name" | "version">,
  source: Blob,
) => {
  if (source.size > managedPackageMaxBytes - 33) throw new Error("Managed package exceeds 64 MiB");
  const plain = new Uint8Array(await source.arrayBuffer());
  const descriptor = {
    extensionId: metadata.extensionId,
    name: metadata.name,
    version: metadata.version,
    revision: digest(plain),
    secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"),
  };
  const sealed = await sealBlob(await packageSpace(accountId, descriptor), plain);
  return {
    descriptor: managedPackageDescriptorSchema.parse({
      ...descriptor,
      blobId: sealed.blobId,
      cipherSha256: digest(sealed.bytes),
      byteLength: sealed.bytes.length,
    }),
    bytes: sealed.bytes,
  };
};

export const openManagedPackage = async (accountId: string, input: ManagedPackageDescriptor, bytes: Uint8Array) => {
  const descriptor = managedPackageDescriptorSchema.parse(input);
  if (bytes.length !== descriptor.byteLength || digest(bytes) !== descriptor.cipherSha256)
    throw new Error("Managed package bytes cannot be verified");
  const plain = await openBlob(await packageSpace(accountId, descriptor), descriptor.blobId, bytes);
  if (digest(plain) !== descriptor.revision) throw new Error("Managed package revision cannot be verified");
  return new Blob([new Uint8Array(plain)], { type: extensionPackageMediaType });
};
