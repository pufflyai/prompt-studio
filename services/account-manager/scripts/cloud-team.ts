// Opt-in disposable harness; this file is never part of the manager server build.
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { SQL } from "bun";
import { createAccountManager } from "../src/authority";
import { migrateAccountManager } from "../src/database";
import { createManagedPackageObjects } from "../src/managed-package-objects";
import { createManagerAuthentication } from "../src/manager-authentication";
import { createManagerHandler } from "../src/manager-http";
import { createOAuthCodeFixture, fixtureMicrosoftClient, oauthBrowserCookie } from "../src/oauth-code.fixture";

const directory = "/workspace/cloud-team";
const config = await Bun.file(`${directory}/config.json`).json();
// Refuse an arbitrary database or externally supplied manager: this is a disposable Cloud run only.
if (
  !new URL(config.databaseUrl).hostname.startsWith("ct-") ||
  !new URL(config.managerOrigin).hostname.startsWith("ct-")
)
  throw new Error("Cloud team fixture requires its owned disposable services");
const admin = new SQL(config.databaseUrl);
for (const name of ["manager", "relay"]) {
  await admin.unsafe(`CREATE ROLE ${name} LOGIN PASSWORD '${config.controlToken}'`);
  await admin.unsafe(`CREATE DATABASE ${name} OWNER ${name}`);
  await admin.unsafe(`REVOKE ALL ON DATABASE ${name} FROM PUBLIC`);
}
await admin.close();
const url = new URL(config.databaseUrl);
url.username = "manager";
url.password = config.controlToken;
url.pathname = "/manager";
const databaseUrl = url.href;
await migrateAccountManager(databaseUrl, new URL("../drizzle/", import.meta.url).pathname);
const s3 = {
  endpoint: config.objectEndpoint,
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: config.objectKey, secretAccessKey: config.objectSecret },
};
const client = new S3Client(s3);
await client.send(new CreateBucketCommand({ Bucket: "cloud-team" }));
client.destroy();
const objects = createManagedPackageObjects("cloud-team", s3);
const auth = createManagerAuthentication(
  {
    databaseUrl,
    origin: config.managerOrigin,
    audience: config.relayOrigin,
    secret: config.controlToken,
    googleClientId: "fixture-google-client",
    googleClientSecret: "fixture-google-secret",
    microsoft: fixtureMicrosoftClient,
    sessionLifetimeSeconds: 7200,
    sessionUpdateAgeSeconds: 3600,
    accessLifetimeSeconds: 30,
  },
  objects,
);
const manager = createAccountManager(databaseUrl);
const oauth = await createOAuthCodeFixture();
const handler = createManagerHandler(auth, config.managerOrigin);
const server = Bun.serve({
  hostname: "0.0.0.0",
  port: 8443,
  tls: { cert: Bun.file(`${directory}/ca.pem`), key: Bun.file(`${directory}/key.pem`) },
  fetch: handler,
});
await Bun.write(
  `${directory}/trust.json`,
  JSON.stringify({ issuer: config.managerOrigin, audience: config.relayOrigin, jwks: await auth.jwks() }),
);
const subjects = { owner: crypto.randomUUID(), member: crypto.randomUUID() };
const signIn = async (url: string, role: "owner" | "member") => {
  const login = new URL(url);
  if (login.origin !== config.managerOrigin || login.pathname !== "/v1/native-login")
    throw new Error("Invalid native login");
  const started = await handler(new Request(login));
  const provider = new URL(started.headers.get("location")!);
  const callback = await oauth.complete("microsoft", provider, {
    claims: {
      sub: subjects[role],
      oid: subjects[role],
      email: `${role}@cloud-team.fixture.test`,
      name: `Cloud test ${role}`,
    },
  });
  const completed = await handler(new Request(callback, { headers: { cookie: oauthBrowserCookie(started) } }));
  const location = completed.headers.get("location");
  if (!location?.startsWith(`${config.managerOrigin}/v1/native-callback?`)) throw new Error("OAuth callback failed");
  const result = await handler(
    new Request(location, {
      headers: { cookie: [oauthBrowserCookie(started), oauthBrowserCookie(completed)].join("; ") },
    }),
  );
  const native = result.headers.get("location");
  if (!native || new URL(native).searchParams.has("error")) throw new Error("Native approval failed");
  return { callback: native };
};
// Privileged fixture operations listen on owner-pod loopback only, never through the manager Service.
const control = Bun.serve({
  hostname: "127.0.0.1",
  port: 8445,
  async fetch(request) {
    if (request.method !== "POST" || request.headers.get("authorization") !== `Bearer ${config.controlToken}`)
      return new Response(null, { status: 403 });
    try {
      const body = await request.json();
      if (new URL(request.url).pathname === "/sign-in" && ["owner", "member"].includes(body.role))
        return Response.json(await signIn(body.url, body.role));
      if (new URL(request.url).pathname === "/grant-relay") {
        await manager.setFeature({ accountId: body.accountId, feature: "relay", enabled: true });
        return Response.json({ ok: true });
      }
      return new Response(null, { status: 404 });
    } catch (error) {
      console.error("Cloud team fixture operation failed", error instanceof Error ? error.name : "unknown");
      return Response.json({ error: "Fixture operation failed; inspect owned manager log" }, { status: 500 });
    }
  },
});
let closing = false;
const close = async () => {
  if (closing) return;
  closing = true;
  await Promise.all([server.stop(true), control.stop(true)]);
  oauth.close();
  await auth.close();
  await manager.close();
  objects.close();
};
process.once("SIGTERM", () => {
  void close();
});
process.once("SIGINT", () => {
  void close();
});
console.log("Disposable real account manager ready (simulated Microsoft provider)");
