import type { createManagerAuthentication } from "./manager-authentication";

// Only the native process listening on IPv4 loopback receives the short-lived, single-use code.
const callback = (request: Request) => {
  const input = new URL(request.url).searchParams;
  const url = new URL(input.get("callback") ?? "");
  const state = input.get("state");
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/callback" ||
    url.search ||
    url.hash ||
    !state ||
    !/^[a-zA-Z0-9_-]{32,}$/.test(state)
  )
    throw new Error("Invalid callback");
  return { url, state };
};

export const nativeLogin = async (
  auth: ReturnType<typeof createManagerAuthentication>,
  origin: string,
  request: Request,
) => {
  if (request.method !== "GET") return new Response(null, { status: 405 });
  try {
    const { url, state } = callback(request);
    if (new URL(request.url).pathname === "/v1/native-login") {
      const completed = new URL("/v1/native-callback", origin);
      completed.searchParams.set("callback", url.href);
      completed.searchParams.set("state", state);
      const response = await auth.nativeLogin(completed.href);
      if (!response.ok) throw new Error("Sign-in unavailable");
      const result = (await response.json()) as { url: string };
      const headers = new Headers(response.headers);
      headers.set("location", result.url);
      headers.set("cache-control", "no-store");
      headers.set("referrer-policy", "no-referrer");
      return new Response(null, { status: 302, headers });
    }
    const code = await auth.nativeCode(request.headers);
    url.searchParams.set("code", code.token);
    url.searchParams.set("state", state);
    return new Response(null, {
      status: 302,
      headers: { location: url.href, "cache-control": "no-store", "referrer-policy": "no-referrer" },
    });
  } catch {
    return Response.json(
      { error: "Native sign-in unavailable" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
};
