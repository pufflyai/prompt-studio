import { expect, test } from "bun:test";
import { readConfig } from "./service";

test("listener configuration uses explicit environment values with local defaults", () => {
  expect(readConfig({})).toEqual({ hostname: "127.0.0.1", port: 8080 });
  expect(readConfig({ RELAY_HOST: "0.0.0.0", RELAY_PORT: "9090" })).toEqual({ hostname: "0.0.0.0", port: 9090 });
});

for (const value of ["bad", "-1", "65536", "1.5", ""]) {
  test(`rejects invalid listener port ${JSON.stringify(value)}`, () => {
    expect(() => readConfig({ RELAY_PORT: value })).toThrow("RELAY_PORT");
  });
}
