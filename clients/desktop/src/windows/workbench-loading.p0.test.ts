import { expect, test } from "bun:test";
import { prepareWorkbenchDocument } from "./workbench-loading";

const runtime = (origin: string) => ({ origin, token: "isolated-workbench-test" });

test("a failed login releases its document navigation before Retry can start", async () => {
  const navigation = Promise.withResolvers<void>();
  let navigating = false;
  const server = Bun.serve({ port: 0, fetch: () => new Response(null, { status: 500 }) });
  const contents = {
    async loadURL() {
      navigating = true;
      try {
        await navigation.promise;
      } finally {
        navigating = false;
      }
    },
    async executeJavaScript() {},
    stop: () => navigation.reject(new Error("Navigation stopped")),
  };
  try {
    await expect(prepareWorkbenchDocument(contents, runtime(server.url.origin), Promise.resolve())).rejects.toThrow(
      "Runtime browser login failed with status 500",
    );
    expect(navigating).toBe(false);
  } finally {
    navigation.resolve();
    server.stop(true);
  }
});

test("a failed document releases its login request and retains the navigation error", async () => {
  const requested = Promise.withResolvers<void>();
  const response = Promise.withResolvers<Response>();
  const failure = new Error("Document navigation failed");
  let requesting = false;
  const server = Bun.serve({
    port: 0,
    async fetch() {
      requested.resolve();
      return response.promise;
    },
  });
  const contents = {
    async loadURL() {
      await requested.promise;
      throw failure;
    },
    async executeJavaScript() {},
    stop() {
      throw new Error("The document was already destroyed");
    },
  };
  const fetcher = async (input: string, init: RequestInit) => {
    requesting = true;
    try {
      return await fetch(input, init);
    } finally {
      requesting = false;
    }
  };
  try {
    await expect(
      prepareWorkbenchDocument(contents, runtime(server.url.origin), Promise.resolve(), fetcher),
    ).rejects.toBe(failure);
    expect(requesting).toBe(false);
  } finally {
    response.resolve(new Response(null, { status: 500 }));
    server.stop(true);
  }
});

test("a synchronously destroyed document releases its login request", async () => {
  const response = Promise.withResolvers<Response>();
  const failure = new Error("The document was already destroyed");
  let requesting = false;
  const server = Bun.serve({ port: 0, fetch: () => response.promise });
  const contents = {
    loadURL() {
      throw failure;
    },
    async executeJavaScript() {},
    stop() {
      throw failure;
    },
  };
  const fetcher = async (input: string, init: RequestInit) => {
    requesting = true;
    try {
      return await fetch(input, init);
    } finally {
      requesting = false;
    }
  };
  try {
    await expect(
      prepareWorkbenchDocument(contents, runtime(server.url.origin), Promise.resolve(), fetcher),
    ).rejects.toBe(failure);
    expect(requesting).toBe(false);
  } finally {
    response.resolve(new Response(null, { status: 500 }));
    server.stop(true);
  }
});

test("loads static assets during an upgrade and requests browser login only after runtime readiness", async () => {
  const ready = Promise.withResolvers<void>();
  const navigated = Promise.withResolvers<void>();
  let migrated = false;
  const calls: string[] = [];
  const origin = "http://127.0.0.1:43127";
  const contents = {
    async loadURL(url: string) {
      calls.push(url);
      navigated.resolve();
    },
    async executeJavaScript(script: string) {
      calls.push(script);
    },
    stop() {},
  };
  const fetcher = async (url: string) => {
    calls.push(url);
    if (!migrated) throw new TypeError("fetch failed");
    return Response.json({ url: `${origin}/#browser-login=fixture` });
  };
  const startup = prepareWorkbenchDocument(contents, runtime(origin), ready.promise, fetcher);
  try {
    await navigated.promise;
    expect(calls).toEqual([`${origin}/?desktop-startup=1`]);
  } finally {
    migrated = true;
    ready.resolve();
    await startup;
  }
  expect(calls).toEqual([
    `${origin}/?desktop-startup=1`,
    `${origin}/runtime/browser-login`,
    'void (window.location.hash = "#browser-login=fixture")',
  ]);
});

test("an early navigation failure releases preparation while the database is still migrating", async () => {
  const ready = Promise.withResolvers<void>();
  const failure = new Error("Workbench navigation failed");
  let loginRequests = 0;
  const contents = {
    async loadURL() {
      throw failure;
    },
    async executeJavaScript() {},
    stop() {},
  };
  const startup = prepareWorkbenchDocument(contents, runtime("http://127.0.0.1:43127"), ready.promise, async () => {
    loginRequests++;
    throw new Error("Unexpected login");
  });
  try {
    await expect(startup).rejects.toBe(failure);
  } finally {
    ready.resolve();
  }
  await Promise.resolve();
  expect(loginRequests).toBe(0);
});
