import { expect, test } from "bun:test";
import { openManagedPackage, sealManagedPackage } from "./managed-package-crypto";

test("managed packages keep frozen bytes private and authenticate their team, extension and revision", async () => {
  const bytes = new TextEncoder().encode("private team tool source; keep this exact frozen revision");
  const sealed = await sealManagedPackage(
    "team-a",
    {
      extensionId: "fixture.private-tool",
      name: "Private tool",
      version: "1.0.0",
    },
    new Blob([bytes]),
  );
  expect(sealed.descriptor.revision).toBe(new Bun.CryptoHasher("sha256").update(bytes).digest("hex"));
  expect(new TextDecoder().decode(sealed.bytes)).not.toContain("private team tool source");
  expect(
    new Uint8Array(await (await openManagedPackage("team-a", sealed.descriptor, sealed.bytes)).arrayBuffer()),
  ).toEqual(bytes);
  await expect(openManagedPackage("team-b", sealed.descriptor, sealed.bytes)).rejects.toThrow();
  await expect(
    openManagedPackage("team-a", { ...sealed.descriptor, extensionId: "fixture.substitute" }, sealed.bytes),
  ).rejects.toThrow();
  await expect(
    openManagedPackage("team-a", { ...sealed.descriptor, revision: "b".repeat(64) }, sealed.bytes),
  ).rejects.toThrow();
  const damaged = new Uint8Array(sealed.bytes);
  damaged[damaged.length - 1] ^= 1;
  await expect(openManagedPackage("team-a", sealed.descriptor, damaged)).rejects.toThrow();
});
