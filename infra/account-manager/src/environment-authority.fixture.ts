import { strict as assert } from "node:assert";
import type * as Authority from "./index";

export const startEnvironmentAuthority = (
  implementation: typeof Authority,
  manager: ReturnType<typeof Authority.createAccountManager>,
  settings = { serviceSecret: `fixture-service-${crypto.randomUUID()}`, port: 0 },
) => {
  const handler = implementation.createEnvironmentAuthorityHandler(manager, { serviceSecret: settings.serviceSecret });
  const server = Bun.serve({ hostname: "127.0.0.1", port: settings.port, fetch: handler });
  const config = {
    origin: "https://manager.example.test",
    serviceSecret: settings.serviceSecret,
    requestTimeoutMs: 1000,
  };
  let response: Response | undefined;
  const transport = async (url: string, options: RequestInit) => {
    assert.equal(url, `${config.origin}/internal/v1/environment-authority`);
    response = await fetch(new URL(new URL(url).pathname, server.url), options);
    return response;
  };
  return {
    config,
    url: server.url,
    port: server.port!,
    transport,
    response: () => response,
    client: implementation.createEnvironmentAuthorityClient(config, transport),
    request: (body: unknown, secret = settings.serviceSecret, path = "/internal/v1/environment-authority") =>
      fetch(new URL(path, server.url), {
        method: "POST",
        headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    close: () => server.stop(true),
  };
};
