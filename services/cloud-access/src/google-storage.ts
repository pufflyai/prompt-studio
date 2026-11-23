import { createGoogleTokenProvider } from "remote-testing/google-token";
import { v4SigningInput } from "remote-testing/storage-signing";
import { type AccessConfig, AccessError } from "./config";

// Only this central workload receives signing authority. Agent VMs receive object URLs.
export function createGoogleStorageSigner(settings: AccessConfig["settings"]) {
  const token = createGoogleTokenProvider();
  return async (input: { method: "GET" | "PUT"; object: string; expiresSeconds: number }) => {
    const signing = v4SigningInput({
      ...input,
      bucket: settings.storageBucket,
      signer: settings.signerAccount,
      now: new Date(),
    });
    const accessToken = await token("metadata", {
      run: async () => {
        throw new Error("Metadata identity is required.");
      },
    });
    const response = await fetch(
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(settings.signerAccount)}:signBlob`,
      {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ payload: Buffer.from(signing.stringToSign).toString("base64") }),
      },
    );
    if (!response.ok) throw new AccessError(502, "Cloud object signing is unavailable.");
    const result = (await response.json()) as { signedBlob?: string };
    if (!result.signedBlob) throw new AccessError(502, "Cloud object signing is unavailable.");
    return `${signing.url}&X-Goog-Signature=${Buffer.from(result.signedBlob, "base64").toString("hex")}`;
  };
}
