import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import type { createAccountHostFixture } from "./native-host.fixture";

export type Host = Awaited<ReturnType<typeof createAccountHostFixture>>;
export type Device = { id: string; name: string; current: boolean; online: boolean };
export type Status = { login: { accountId: string; deviceId: string } | null; cloudProjects: string[] };

export const call = async <T = unknown>(host: Host, path: string, method = "GET", body?: unknown) => {
  const response = await host.app.request(`/v1${path}`, {
    method,
    ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, body: JSON.parse(text) as T, text };
};
export const token = async (host: Host) =>
  (JSON.parse(await readFile(host.file, "utf8")) as { login: { token: string } | null }).login?.token;

// The fixture provider completes OAuth before the browser follows the manager's native redirect.
export const login = async (host: Host, origin: string, subject: string, provider?: "microsoft") => {
  const started = await call<{ id: string; url: string }>(host, "/account/login", "POST", {
    managerOrigin: origin,
    provider,
  });
  assert.equal(started.status, 200);
  const loginUrl = new URL(started.body.url);
  if (provider)
    assert.equal(loginUrl.searchParams.get("provider"), provider, "The host preserves the selected provider");
  const browser = await fetch(loginUrl, {
    headers: { "x-fixture-oauth-subject": subject },
    redirect: "manual",
  });
  assert.equal(browser.status, 302);
  const url = new URL(browser.headers.get("location")!);
  const cookie = browser.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const completed = await fetch(url, { headers: { cookie }, redirect: "manual" });
  assert.equal(completed.status, 302);
  const invalid = new URL(completed.headers.get("location")!);
  invalid.searchParams.set("state", "another-login-state");
  assert.equal((await fetch(invalid)).status, 400);
  assert.equal((await fetch(completed.headers.get("location")!)).status, 200);
  assert.equal((await call<{ status: string }>(host, `/account/login/${started.body.id}`)).body.status, "complete");
  // Sign-in completes at credential persistence; discovery runs without delaying its callback.
  await host.account.refresh();
  const status = await call<Status>(host, "/account");
  assert.ok(status.body.login, "The host reports its saved sign-in");
  const credential = await token(host);
  assert.ok(credential, "Sign-in saved a device credential");
  assert.ok(!status.text.includes(credential), "The device credential never leaves the native host");
  return status.body.login;
};
export const devices = async (host: Host) => (await call<Device[]>(host, "/account/devices")).body;
