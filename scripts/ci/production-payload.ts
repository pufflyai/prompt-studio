import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

interface PayloadIdentity {
  payloadName: string;
  payloadDigest: string;
}
export const describeProductionPayload = async (payloadName: string) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(payloadName)) hash.update(chunk);
  return { payloadName, payloadDigest: hash.digest("hex") };
};
export const assertProductionPayload = async (identity: PayloadIdentity) => {
  const actual = await describeProductionPayload(identity.payloadName);
  if (actual.payloadDigest !== identity.payloadDigest) throw new Error("Candidate payload digest mismatch");
};
if (import.meta.main) {
  const path = "production-build-identity.json";
  const identity = await Bun.file(path).json();
  if (process.argv[2] === "record") {
    const payload = await describeProductionPayload(process.argv[3]!);
    await Bun.write(path, JSON.stringify({ ...identity, ...payload }));
  } else if (process.argv[2] === "check") await assertProductionPayload(identity);
  else throw new Error("Use record <payload> or check");
}
