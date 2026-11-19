import { createHash } from "node:crypto";

// Where run sources and logs live. Remote environments only ever receive signed URLs
// for one object that expire with the run.
export interface RunStorage {
  upload(object: string, archive: Blob): Promise<void>;
  download(object: string): Promise<Uint8Array | null>;
  signedUrl(method: "GET" | "PUT", object: string, expiresSeconds: number): Promise<string>;
}

const HOST = "storage.googleapis.com";

// V4 signing input for a path-style Cloud Storage URL. Pure, so it can be checked offline.
export function v4SigningInput(input: {
  method: "GET" | "PUT";
  bucket: string;
  object: string;
  signer: string;
  now: Date;
  expiresSeconds: number;
}) {
  const datetime = input.now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const date = datetime.slice(0, 8);
  const scope = `${date}/auto/storage/goog4_request`;
  const path = `/${input.bucket}/${input.object.split("/").map(encodeURIComponent).join("/")}`;
  const query = [
    ["X-Goog-Algorithm", "GOOG4-RSA-SHA256"],
    ["X-Goog-Credential", `${input.signer}/${scope}`],
    ["X-Goog-Date", datetime],
    ["X-Goog-Expires", String(input.expiresSeconds)],
    ["X-Goog-SignedHeaders", "host"],
  ]
    .map(([key, value]) => `${encodeURIComponent(key!)}=${encodeURIComponent(value!)}`)
    .join("&");
  const canonical = [input.method, path, query, `host:${HOST}`, "", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["GOOG4-RSA-SHA256", datetime, scope, createHash("sha256").update(canonical).digest("hex")].join(
    "\n",
  );
  return { stringToSign, url: `https://${HOST}${path}?${query}` };
}

// The developer's own Google login uploads, downloads and asks IAM to sign with the
// signer account. Nobody holds the signer's key.
export function gcsStorage(options: { bucket: string; signer: string; token: () => Promise<string> }): RunStorage {
  const headers = async () => ({ Authorization: `Bearer ${await options.token()}` });
  const objectUrl = (object: string) =>
    `https://${HOST}/storage/v1/b/${options.bucket}/o/${encodeURIComponent(object)}`;
  return {
    async upload(object, archive) {
      const response = await fetch(
        `https://${HOST}/upload/storage/v1/b/${options.bucket}/o?uploadType=media&name=${encodeURIComponent(object)}`,
        { method: "POST", headers: { ...(await headers()), "Content-Type": "application/gzip" }, body: archive },
      );
      if (!response.ok) throw new Error(`Upload to ${options.bucket} failed: ${await failure(response)}`);
    },
    async download(object) {
      const response = await fetch(`${objectUrl(object)}?alt=media`, { headers: await headers() });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Download from ${options.bucket} failed: ${await failure(response)}`);
      return new Uint8Array(await response.arrayBuffer());
    },
    async signedUrl(method, object, expiresSeconds) {
      const input = v4SigningInput({
        method,
        bucket: options.bucket,
        object,
        signer: options.signer,
        now: new Date(),
        expiresSeconds,
      });
      const response = await fetch(
        `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(options.signer)}:signBlob`,
        {
          method: "POST",
          headers: { ...(await headers()), "Content-Type": "application/json" },
          body: JSON.stringify({ payload: Buffer.from(input.stringToSign).toString("base64") }),
        },
      );
      if (!response.ok) throw new Error(`Signing with ${options.signer} failed: ${await failure(response)}`);
      const { signedBlob } = (await response.json()) as { signedBlob: string };
      return `${input.url}&X-Goog-Signature=${Buffer.from(signedBlob, "base64").toString("hex")}`;
    },
  };
}

async function failure(response: Response) {
  return `HTTP ${response.status} ${(await response.text()).slice(0, 300)}`;
}
