import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { changeHeadSchema } from "pstdio-api-contracts";
import { z } from "zod";

const receiptKey = randomBytes(32);
const seal = (body: string) => createHmac("sha256", receiptKey).update(body).digest();
const receiptSchema = changeHeadSchema.extend({ provider: z.string(), principal: z.string() });
export const unseal = (receipt: string) => {
  const [body, signature, extra] = receipt.split(".");
  if (!body || !signature || extra !== undefined) throw new Error("Invalid observation receipt.");
  const expected = seal(body);
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("Invalid observation receipt.");
  return receiptSchema.parse(JSON.parse(Buffer.from(body, "base64url").toString()));
};

export const issueReceipt = (input: z.infer<typeof receiptSchema>) => {
  const body = Buffer.from(JSON.stringify(receiptSchema.parse(input))).toString("base64url");
  return `${body}.${seal(body).toString("base64url")}`;
};
