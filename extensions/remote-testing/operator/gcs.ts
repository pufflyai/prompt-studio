import { createHash } from "node:crypto";

const metadata = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
const host = "storage.googleapis.com";

export function createSigner(bucket: string, account: string) {
  let cached: { value: string; until: number } | undefined;

  async function token() {
    if (cached && cached.until > Date.now()) return cached.value;
    const response = await fetch(metadata, {
      headers: { "Metadata-Flavor": "Google" },
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Workload Identity token HTTP " + response.status);
    const credentials = (await response.json()) as { access_token: string; expires_in: number };
    cached = { value: credentials.access_token, until: Date.now() + Math.max(0, credentials.expires_in - 60) * 1000 };
    return cached.value;
  }

  return async (method: "GET" | "PUT", object: string, seconds: number) => {
    const dateTime = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
    const scope = dateTime.slice(0, 8) + "/auto/storage/goog4_request";
    const path = "/" + bucket + "/" + object;
    const query = new URLSearchParams({
      "X-Goog-Algorithm": "GOOG4-RSA-SHA256",
      "X-Goog-Credential": account + "/" + scope,
      "X-Goog-Date": dateTime,
      "X-Goog-Expires": String(seconds),
      "X-Goog-SignedHeaders": "host",
    });
    const canonical = [method, path, query.toString(), "host:" + host, "", "host", "UNSIGNED-PAYLOAD"].join("\n");
    const signatureInput = [
      "GOOG4-RSA-SHA256",
      dateTime,
      scope,
      createHash("sha256").update(canonical).digest("hex"),
    ].join("\n");
    const response = await fetch(
      "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/" +
        encodeURIComponent(account) +
        ":signBlob",
      {
        method: "POST",
        headers: { Authorization: "Bearer " + (await token()), "Content-Type": "application/json" },
        body: JSON.stringify({ payload: Buffer.from(signatureInput).toString("base64") }),
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error("Cloud Storage signing HTTP " + response.status);
    const { signedBlob } = (await response.json()) as { signedBlob: string };
    query.set("X-Goog-Signature", Buffer.from(signedBlob, "base64").toString("hex"));
    return "https://" + host + path + "?" + query.toString();
  };
}
