import { randomBytes } from "node:crypto";
import { z } from "zod";
import { managerRequest } from "./manager-client";

const sessionSchema = z.object({
  session: z.object({ token: z.string().min(1), expiresAt: z.coerce.date() }),
  user: z.object({ id: z.string(), email: z.string() }),
});
export const startNativeLogin = (origin: string, save: (token: string, signal: AbortSignal) => Promise<void>) => {
  const controller = new AbortController();
  const state = randomBytes(32).toString("base64url");
  let status: "pending" | "complete" | "failed" = "pending";
  let consuming = false;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      if (
        url.host !== server.url.host ||
        request.method !== "GET" ||
        url.pathname !== "/callback" ||
        url.searchParams.get("state") !== state ||
        !url.searchParams.get("code") ||
        consuming ||
        status !== "pending"
      )
        return new Response("Invalid sign-in callback", { status: 400 });
      consuming = true;
      // A login that reached its exchange finishes even past the expiry, or its new credential would be lost.
      clearTimeout(expiry);
      try {
        const session = sessionSchema.parse(
          await managerRequest(
            origin,
            "/api/auth/one-time-token/verify",
            undefined,
            {
              token: url.searchParams.get("code"),
            },
            controller.signal,
          ),
        );
        if (session.session.expiresAt <= new Date()) throw new Error("Expired session");
        controller.signal.throwIfAborted();
        await save(session.session.token, controller.signal);
        controller.signal.throwIfAborted();
        status = "complete";
        return new Response("Sign-in complete. You can close this window.", {
          headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" },
        });
      } catch {
        status = "failed";
        return new Response("Sign-in failed. Start sign-in again from Prompt Studio.", {
          status: 401,
          headers: { "cache-control": "no-store" },
        });
      } finally {
        clearTimeout(expiry);
        setTimeout(() => server.stop(true), 0);
      }
    },
  });
  const close = () => {
    controller.abort();
    clearTimeout(expiry);
    if (status === "pending") status = "failed";
    void server.stop(true);
  };
  const expiry = setTimeout(close, 3 * 60_000);
  expiry.unref();
  const url = new URL("/v1/native-login", origin);
  url.searchParams.set("callback", new URL("/callback", server.url).href);
  url.searchParams.set("state", state);
  return { origin, url: url.href, status: () => status, close };
};
