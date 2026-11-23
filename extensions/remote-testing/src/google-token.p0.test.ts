import { afterEach, expect, test } from "bun:test";
import { createGoogleTokenProvider } from "./google-token";

const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true);
});

test("VM storage uses metadata credentials and refreshes before their actual expiry without gcloud", async () => {
  let now = Date.now();
  let requests = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(req) {
      expect(req.headers.get("metadata-flavor")).toBe("Google");
      return Response.json(
        { access_token: `vm-token-${++requests}`, expires_in: 120 },
        { headers: { "Metadata-Flavor": "Google" } },
      );
    },
  });
  servers.push(server);
  const token = createGoogleTokenProvider({
    now: () => now,
    fetch: Object.assign(() => fetch(server.url, { headers: { "Metadata-Flavor": "Google" } }), {
      preconnect: fetch.preconnect,
    }),
  });
  const process = {
    run: async () => {
      throw new Error("VM must not invoke gcloud.");
    },
  };
  expect(await token("metadata", process)).toBe("vm-token-1");
  expect(await token("metadata", process)).toBe("vm-token-1");
  now += 61_000;
  expect(await token("metadata", process)).toBe("vm-token-2");
});

test("personal sign-in and legacy ADC use separate caches and never expose failed command output", async () => {
  const commands: string[][] = [];
  const token = createGoogleTokenProvider();
  const process = {
    run: async (input: { command: string[] }) => {
      commands.push(input.command);
      return { exitCode: 0, stdout: input.command.includes("application-default") ? "adc-private" : "user-private" };
    },
  };
  expect(await token("gcloud", process)).toBe("user-private");
  expect(await token("application-default", process)).toBe("adc-private");
  expect(commands).toEqual([
    ["gcloud", "auth", "print-access-token"],
    ["gcloud", "auth", "application-default", "print-access-token"],
  ]);
  const failing = createGoogleTokenProvider();
  await expect(failing("gcloud", { run: async () => ({ exitCode: 1, stdout: "private-token" }) })).rejects.toThrow(
    "Google sign-in is unavailable",
  );
});
