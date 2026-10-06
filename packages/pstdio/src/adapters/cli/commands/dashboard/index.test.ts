import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { launch } from ".";

let stdoutWriteSpy: ReturnType<typeof mock>;
const originalStdoutWrite = process.stdout.write.bind(process.stdout);

beforeEach(() => {
  stdoutWriteSpy = mock((_chunk: unknown) => true);
  process.stdout.write = stdoutWriteSpy as typeof process.stdout.write;
});

afterEach(() => {
  process.stdout.write = originalStdoutWrite;
});

const createDeps = () => {
  const openBrowser: string[] = [];
  return { openBrowser, deps: { openBrowser: (url: string) => openBrowser.push(url) } };
};

const startRuntime = (options: { loginRoute?: boolean } = {}) => {
  const authorizations: (string | null)[] = [];
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => {
      authorizations.push(request.headers.get("authorization"));
      const url = new URL(request.url);
      const isLogin = url.pathname === "/runtime/browser-login" && request.method === "POST";
      return isLogin && options.loginRoute !== false
        ? Response.json({ url: `${url.origin}/runtime/browser-login?code=one-time` })
        : Response.json({ error: "Not Found" }, { status: 404 });
    },
  });
  const origin = `http://127.0.0.1:${server.port}`;
  process.env.PSTDIO_API_URL = origin;
  return { authorizations, origin, stop: () => server.stop(true) };
};

describe("launch", () => {
  test("opens the runtime origin published by the API auto-start middleware", async () => {
    const { openBrowser, deps } = createDeps();
    process.env.PSTDIO_API_URL = "http://127.0.0.1:43123";

    await launch({ apiPort: 19840, openBrowser: true }, deps);

    expect(openBrowser).toEqual(["http://127.0.0.1:43123"]);
    expect(stdoutWriteSpy).toHaveBeenCalledWith("Dashboard: http://127.0.0.1:43123\n");
    expect(stdoutWriteSpy).toHaveBeenCalledWith("API:       http://127.0.0.1:43123/v1\n");
  });

  test("falls back to 127.0.0.1:<api-port> when PSTDIO_API_URL is unset", async () => {
    const { openBrowser, deps } = createDeps();
    delete process.env.PSTDIO_API_URL;

    await launch({ apiPort: 3000, openBrowser: true }, deps);

    expect(openBrowser).toEqual(["http://127.0.0.1:3000"]);
  });

  test("does not open the browser when disabled", async () => {
    const { openBrowser, deps } = createDeps();
    process.env.PSTDIO_API_URL = "http://127.0.0.1:43123";

    await launch({ apiPort: 19840, openBrowser: false }, deps);

    expect(openBrowser).toEqual([]);
  });

  test("opens a single-use login link instead of handing the runtime token to the browser", async () => {
    const { openBrowser, deps } = createDeps();
    const runtime = startRuntime();
    process.env.PSTDIO_API_TOKEN = "runtime-secret";

    try {
      await launch({ apiPort: 19840, openBrowser: true }, deps);
    } finally {
      runtime.stop();
    }

    expect(runtime.authorizations).toEqual(["Bearer runtime-secret"]);
    expect(openBrowser).toEqual([`${runtime.origin}/runtime/browser-login?code=one-time`]);
    expect(stdoutWriteSpy).toHaveBeenCalledWith(`Dashboard: ${runtime.origin}\n`);
  });

  test("prints the login link when it does not open a browser", async () => {
    const { openBrowser, deps } = createDeps();
    const runtime = startRuntime();
    process.env.PSTDIO_API_TOKEN = "runtime-secret";

    try {
      await launch({ apiPort: 19840, openBrowser: false }, deps);
    } finally {
      runtime.stop();
    }

    expect(openBrowser).toEqual([]);
    expect(stdoutWriteSpy).toHaveBeenCalledWith(
      `Sign in:   ${runtime.origin}/runtime/browser-login?code=one-time (single use, expires in 60 seconds)\n`,
    );
  });

  test("opens the plain URL when the runtime has no login route", async () => {
    const { openBrowser, deps } = createDeps();
    const runtime = startRuntime({ loginRoute: false });
    process.env.PSTDIO_API_TOKEN = "runtime-secret";

    try {
      await launch({ apiPort: 19840, openBrowser: true }, deps);
    } finally {
      runtime.stop();
    }

    expect(openBrowser).toEqual([runtime.origin]);
  });
});
