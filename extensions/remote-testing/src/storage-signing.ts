import { createHash } from "node:crypto";

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
