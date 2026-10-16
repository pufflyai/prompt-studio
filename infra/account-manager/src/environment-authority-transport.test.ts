import { expect, test } from "bun:test";
import { strict as assert } from "node:assert";
import { createEnvironmentAuthorityClient } from "./environment-authority-client";

const startUpstream = (respond: (request: Request) => Response | Promise<Response>) => {
  const config = {
    origin: "https://manager.example.test",
    serviceSecret: `fixture-service-${crypto.randomUUID()}`,
    requestTimeoutMs: 1000,
  };
  let requests = 0;
  let response: Response | undefined;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      requests++;
      return respond(request);
    },
  });
  const transport = async (url: string, options: RequestInit) => {
    assert.equal(url, `${config.origin}/internal/v1/environment-authority`);
    response = await fetch(new URL(new URL(url).pathname, server.url), options);
    return response;
  };
  return {
    config,
    transport,
    url: server.url,
    requests: () => requests,
    response: () => response,
    client: createEnvironmentAuthorityClient(config, transport),
    close: () => server.stop(true),
  };
};

test("client configuration and invalid input discard sensitive validation objects", async () => {
  const marker = `private-${crypto.randomUUID()}`;
  const config = { origin: "https://manager.example.test", serviceSecret: marker, requestTimeoutMs: 1000 };
  for (const origin of [
    marker,
    `http://${marker}.test`,
    `https://user:${marker}@manager.test`,
    `https://manager.test/${marker}`,
  ]) {
    let error: unknown;
    try {
      createEnvironmentAuthorityClient({ ...config, origin });
    } catch (reason) {
      error = reason;
    }
    expect(error).toBeInstanceOf(Error);
    expect(Bun.inspect(error, { depth: Infinity })).not.toContain(marker);
  }
  const upstream = startUpstream(() => Response.json({ identity: null }));
  try {
    const error = await upstream.client.authorize({ marker } as never, "workbench").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    expect(Bun.inspect(error, { depth: Infinity })).not.toContain(marker);
    expect(upstream.requests()).toBe(0);
  } finally {
    await upstream.close();
  }
});

test("failed or malformed authority responses cannot return or retain credentials", async () => {
  const token = `environment-${crypto.randomUUID()}`;
  let respond = () => Response.json({ identity: null });
  const upstream = startUpstream(async (request) => {
    expect(request.headers.get("authorization")).toBe(`Bearer ${upstream.config.serviceSecret}`);
    expect(await request.json()).toEqual({ token, workbenchId: "workbench" });
    return respond();
  });
  try {
    const marker = [token, upstream.config.serviceSecret].join(" ");
    const cases = [
      () => Response.json({ error: marker }, { status: 503 }),
      () => Response.json({ error: marker }, { status: 401 }),
      () => new Response(marker, { headers: { "content-type": "application/json" } }),
      () => Response.json({ identity: null, sensitive: marker }),
      () => Response.json({ identity: { accountId: "account", workbenchId: "another", environmentId: "env" } }),
      () =>
        Response.json({
          identity: { accountId: "account", workbenchId: "workbench", environmentId: "env", token: marker },
        }),
    ];
    for (const response of cases) {
      respond = response;
      const error = await upstream.client.authorize(token, "workbench").catch((reason: unknown) => reason);
      expect(error).toBeInstanceOf(Error);
      for (const secret of [token, upstream.config.serviceSecret])
        expect(Bun.inspect(error, { depth: Infinity })).not.toContain(secret);
      expect(upstream.response()?.bodyUsed).toBe(true);
    }
    expect(upstream.requests()).toBe(cases.length);
  } finally {
    await upstream.close();
  }
});

test("authority redirects cannot forward either private credential", async () => {
  let forwarded = 0;
  const destination = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      forwarded++;
      return Response.json({ identity: null });
    },
  });
  const upstream = startUpstream(() => Response.redirect(destination.url, 307));
  const token = `environment-${crypto.randomUUID()}`;
  try {
    const error = await upstream.client.authorize(token, "workbench").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    expect(forwarded).toBe(0);
    expect(upstream.requests()).toBe(1);
    for (const secret of [token, upstream.config.serviceSecret])
      expect(Bun.inspect(error, { depth: Infinity })).not.toContain(secret);
  } finally {
    await upstream.close();
    await destination.stop(true);
  }
});

test("the explicit authority deadline covers a real pending HTTP response", async () => {
  let produced: Promise<Response> | undefined;
  let finished = false;
  const upstream = startUpstream(() => {
    produced = Bun.sleep(100).then(() => {
      finished = true;
      return Response.json({ identity: null });
    });
    return produced;
  });
  try {
    const client = createEnvironmentAuthorityClient({ ...upstream.config, requestTimeoutMs: 20 }, upstream.transport);
    const error = await client.authorize("environment", "workbench").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    expect(upstream.requests()).toBe(1);
    expect(finished).toBe(false);
  } finally {
    await produced;
    await upstream.close();
  }
});

test("the authority deadline covers an unfinished JSON body after response headers", async () => {
  let produced: Promise<void> | undefined;
  let finished = false;
  let cancelled = false;
  const upstream = startUpstream(
    () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"identity":'));
            produced = Bun.sleep(100).then(() => {
              if (cancelled) return;
              finished = true;
              controller.enqueue(new TextEncoder().encode("null}"));
              controller.close();
            });
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { "content-type": "application/json" } },
      ),
  );
  try {
    const client = createEnvironmentAuthorityClient({ ...upstream.config, requestTimeoutMs: 20 }, upstream.transport);
    const error = await client.authorize("environment", "workbench").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(Error);
    expect(upstream.response()?.status).toBe(200);
    expect(finished).toBe(false);
  } finally {
    await produced;
    await upstream.close();
  }
});
