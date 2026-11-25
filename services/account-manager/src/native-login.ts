import { type AccountSignInError, accountSignInProviderSchema } from "pstdio-sync-contracts";
import type { createManagerAuthentication } from "./manager-authentication";

// Only the native process listening on IPv4 loopback receives the short-lived, single-use code.
export const readNativeCallback = (input: URLSearchParams) => {
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
  const provider = accountSignInProviderSchema.parse(input.get("provider") ?? "google");
  return { url, state, provider };
};

const redirect = (url: URL, headers = new Headers()) => {
  headers.set("location", url.href);
  headers.set("cache-control", "no-store");
  headers.set("referrer-policy", "no-referrer");
  return new Response(null, { status: 302, headers });
};

export const nativeLogin = async (
  auth: ReturnType<typeof createManagerAuthentication>,
  address: string,
  request: Request,
) => {
  if (request.method !== "GET") return new Response(null, { status: 405 });
  try {
    const incoming = new URL(request.url);
    const attempt = readNativeCallback(incoming.searchParams);
    const { url, state, provider } = attempt;
    const fail = (error: AccountSignInError) => {
      url.searchParams.set("error", error);
      url.searchParams.set("state", state);
      return redirect(url);
    };
    if (incoming.pathname === "/v1/native-error") {
      return fail(incoming.searchParams.get("error") === "access_denied" ? "provider-denied" : "provider-failed");
    }
    if (incoming.pathname === "/v1/native-login") {
      if (!auth.supportsSignIn(provider)) return fail("provider-unavailable");
      const completed = new URL(`${address}/v1/native-callback`);
      completed.searchParams.set("callback", url.href);
      completed.searchParams.set("state", state);
      completed.searchParams.set("provider", provider);
      const error = new URL(completed);
      error.pathname = `${new URL(address).pathname.replace(/\/+$/, "")}/v1/native-error`;
      const response = await auth.nativeLogin(provider, completed.href, error.href);
      if (!response.ok) return fail("provider-unavailable");
      const result = (await response.json()) as { url: string };
      return redirect(new URL(result.url), new Headers(response.headers));
    }
    const code = await auth.nativeCode(request.headers, attempt);
    url.searchParams.set("code", code.token);
    url.searchParams.set("state", state);
    return redirect(url);
  } catch {
    return Response.json(
      { error: "Native sign-in unavailable" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
};
