export const digestCredential = (token: string) => new Bun.CryptoHasher("sha256").update(token).digest("hex");
export const createCredential = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
