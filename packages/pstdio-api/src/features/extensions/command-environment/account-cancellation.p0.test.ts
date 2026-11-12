import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createNativeAccount } from "../../../services/account/native-account";
import { createNativeStore } from "../../../services/account/native-store";
import { createAccountRoutes } from "../../account/routes";
import { createAccountApi } from "./account";

for (const entry of ["extension", "HTTP"] as const)
  test(`cancelling an ${entry} account read closes its actual device request before a returning read enters`, async () => {
    const dir = await mkdtemp(join(tmpdir(), "pstdio-account-cancel-"));
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const cancelledRequest = Promise.withResolvers<void>();
    let requests = 0;
    let active = 0;
    let maximum = 0;
    const manager = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        if (new URL(request.url).pathname !== "/v1/devices") return new Response(null, { status: 404 });
        requests++;
        active++;
        maximum = Math.max(maximum, active);
        let finished = false;
        const finish = () => {
          if (!finished) {
            finished = true;
            active--;
          }
        };
        request.signal.addEventListener(
          "abort",
          () => {
            finish();
            cancelledRequest.resolve();
          },
          { once: true },
        );
        if (requests === 1) {
          entered.resolve();
          await Promise.race([release.promise, cancelledRequest.promise]);
        }
        finish();
        return Response.json({ deviceId: "device", devices: [] });
      },
    });
    const file = join(dir, "account.json");
    await createNativeStore(file).save({
      accountId: "account",
      deviceId: "device",
      token: "secret-fixture",
      managerOrigin: manager.url.origin,
      relayOrigin: manager.url.origin,
    });
    const account = createNativeAccount({
      file,
      environment: { get: async () => ({ environmentId: "device" }) },
      projects: { get: async () => null } as never,
    });
    const abort = new AbortController();
    const api = createAccountApi(account, "project", abort.signal);
    const routes = createAccountRoutes(account);
    const reading =
      entry === "extension"
        ? api.devices().then(
            () => "completed",
            () => "cancelled",
          )
        : Promise.resolve(routes.request(new Request("http://runtime/account/devices", { signal: abort.signal }))).then(
            (response) => (response.ok ? "completed" : "cancelled"),
            () => "cancelled",
          );
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await entered.promise;
      abort.abort(new DOMException("View closed", "AbortError"));
      const outcome = await Promise.race([
        reading,
        new Promise<string>((resolve) => {
          timer = setTimeout(() => resolve("still pending"), 100);
        }),
      ]);
      expect(outcome).toBe("cancelled");
      // The cancelled socket must leave before another view admits this same finite source.
      await cancelledRequest.promise;
      expect(active).toBe(0);
      expect(await createAccountApi(account, "project").devices()).toEqual([]);
      expect(maximum).toBe(1);
    } finally {
      clearTimeout(timer);
      abort.abort();
      release.resolve();
      await reading;
      await account.close();
      await manager.stop(true);
      await rm(dir, { recursive: true, force: true });
    }
  });
