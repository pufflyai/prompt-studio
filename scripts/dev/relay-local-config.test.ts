import { expect, test } from "bun:test";
import { type LocalAccountFile, localLoginNeedsEnrollment, savedFixtureLogin } from "./relay-local-config";

const device = { accountId: "account", deviceId: "device" };
const login = {
  ...device,
  managerOrigin: "https://authority:8443",
  relayOrigin: "https://relay:8080",
  token: "device-secret",
};

test("the launcher keeps only a saved login of this app's fixture device", () => {
  const saved = (file: LocalAccountFile) => savedFixtureLogin(file, device);
  expect(saved({ login })).toEqual(login);
  expect(saved({ login: null })).toBeNull();
  expect(saved({ login: { ...login, deviceId: "other-device" } })).toBeNull();
  expect(saved({ login: { ...login, accountId: "real-account" } })).toBeNull();
});

test("the launcher enrolls again only when the manager denies the saved token", () => {
  expect(localLoginNeedsEnrollment(200)).toBe(false);
  expect(localLoginNeedsEnrollment(401)).toBe(true);
  expect(() => localLoginNeedsEnrollment(503)).toThrow("unavailable");
});
