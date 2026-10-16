import { afterAll, beforeAll, expect, test } from "bun:test";
import { SignJWT } from "jose";
import { createGoogleIdentityVerifier } from "./google-identity";
import { createGoogleFixture } from "./google-identity.fixture";

let fixture: Awaited<ReturnType<typeof createGoogleFixture>>;
beforeAll(async () => {
  fixture = await createGoogleFixture();
});
afterAll(() => fixture.close());

test("verified Google identity uses its stable subject and canonical issuer across overlapping signing keys", async () => {
  const verify = createGoogleIdentityVerifier(fixture.clientId, fixture.transport);
  const before = fixture.requests();
  for (const [index, issuer] of ["https://accounts.google.com", "accounts.google.com"].entries()) {
    const token = await fixture.sign({ iss: issuer, email: `${index}@example.com` }, index);
    expect(await verify(token, fixture.nonce)).toEqual({
      issuer: "https://accounts.google.com",
      subject: fixture.subject,
    });
  }
  expect(fixture.requests() - before).toBe(1);
});

test("the configured web client can be the sole audience with its authorized presenter", async () => {
  const verify = createGoogleIdentityVerifier(fixture.clientId, fixture.transport);
  const token = await fixture.sign({ aud: [fixture.clientId], azp: fixture.clientId });
  expect((await verify(token, fixture.nonce)).subject).toBe(fixture.subject);
});

const now = Math.floor(Date.now() / 1000);
test.each([
  ["foreign issuer", { iss: "https://attacker.example" }],
  ["foreign audience", { aud: "another-client" }],
  ["untrusted extra audience", { aud: ["manager.apps.googleusercontent.com", "another-client"] }],
  ["foreign presenter", { azp: "another-client" }],
  ["missing subject", { sub: undefined }],
  ["empty subject", { sub: "" }],
  ["oversized subject", { sub: "a".repeat(256) }],
  ["non-ASCII subject", { sub: "non-ascii-å" }],
  ["missing nonce", { nonce: undefined }],
  ["wrong nonce", { nonce: "another-login" }],
  ["missing expiry", { exp: undefined }],
  ["expired token", { exp: now - 60 }],
  ["non-numeric expiry", { exp: "tomorrow" }],
  ["fractional expiry", { exp: now + 60.5 }],
  ["missing issuance time", { iat: undefined }],
  ["future issuance", { iat: now + 60 }],
  ["invalid issuance time", { iat: -1 }],
])("Google identity rejects %s", async (_name, claims) => {
  const verify = createGoogleIdentityVerifier(fixture.clientId, fixture.transport);
  await expect(verify(await fixture.sign(claims), fixture.nonce)).rejects.toThrow();
});

test.each([
  ["foreign audience", { aud: "another-client" }],
  ["foreign issuer", { iss: "https://attacker.example" }],
  ["expired token", { exp: 1 }],
])("rejected Google identity does not expose raw claims for %s", async (_name, claims) => {
  const verify = createGoogleIdentityVerifier(fixture.clientId, fixture.transport);
  const privateProfile = "private-profile-from-rejected-token";
  const token = await fixture.sign({ ...claims, email: privateProfile, profile: { name: privateProfile } });
  const error = await verify(token, fixture.nonce).catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(Error);
  expect(Bun.inspect(error, { depth: Infinity })).not.toContain(privateProfile);
  expect(Bun.inspect(error, { depth: Infinity })).not.toContain(token);
});

test("a token cannot substitute a signature, algorithm or signing key", async () => {
  const verify = createGoogleIdentityVerifier(fixture.clientId, fixture.transport);
  const token = await fixture.sign();
  const parts = token.split(".");
  parts[1] = Buffer.from(JSON.stringify({ sub: "attacker" })).toString("base64url");
  await expect(verify(parts.join("."), fixture.nonce)).rejects.toThrow();
  await expect(verify(await fixture.sign({}, 1, { kid: "key-0" }), fixture.nonce)).rejects.toThrow();
  await expect(verify(await fixture.sign({}, 0, { kid: "unknown-key" }), fixture.nonce)).rejects.toThrow();
  const symmetric = await new SignJWT({ sub: fixture.subject })
    .setProtectedHeader({ alg: "HS256" })
    .sign(crypto.getRandomValues(new Uint8Array(32)));
  await expect(verify(symmetric, fixture.nonce)).rejects.toThrow();
  await expect(verify(`${parts[0]}.${parts[1]}.`, fixture.nonce)).rejects.toThrow();
});

test("token headers cannot select the source of trusted signing keys", async () => {
  const verify = createGoogleIdentityVerifier(fixture.clientId, fixture.transport);
  const token = await fixture.sign({}, 0, { jku: "https://attacker.example/keys" });
  expect((await verify(token, fixture.nonce)).subject).toBe(fixture.subject);
});

test("unavailable trusted signing keys do not authenticate a cold verifier", async () => {
  const unavailable = await createGoogleFixture();
  try {
    unavailable.failRequests();
    const verify = createGoogleIdentityVerifier(unavailable.clientId, unavailable.transport);
    await expect(verify(await unavailable.sign(), unavailable.nonce)).rejects.toThrow();
    expect(unavailable.requests()).toBe(1);
  } finally {
    unavailable.close();
  }
});

test("verification requires trusted client and pending-login context", async () => {
  expect(() => createGoogleIdentityVerifier("", fixture.transport)).toThrow();
  const verify = createGoogleIdentityVerifier(fixture.clientId, fixture.transport);
  await expect(verify(await fixture.sign(), "")).rejects.toThrow();
  await expect(verify("invalid-token", fixture.nonce)).rejects.toThrow();
});
