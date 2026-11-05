import { randomBytes } from "node:crypto";
import { serviceUrl } from "pstdio-sync/relay";
import { z } from "zod";
import { managerRequest } from "./manager-client";

const sessionSchema = z.object({
  session: z.object({ token: z.string().min(1), expiresAt: z.coerce.date() }),
  user: z.object({ id: z.string(), email: z.string() }),
});
export const startNativeLogin = (
  origin: string,
  save: (token: string, signal: AbortSignal, user: { email: string }) => Promise<void>,
  changed: () => void = () => {},
) => {
  const controller = new AbortController();
  const state = randomBytes(32).toString("base64url");
  let status: "pending" | "complete" | "failed" = "pending";
  const settle = (next: typeof status) => {
    if (next === status) return;
    status = next;
    changed();
  };
  let consuming = false;
  let saving: Promise<void> | undefined;
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
        saving = save(session.session.token, controller.signal, { email: session.user.email });
        await saving;
        // The owner checks cancellation and rolls back before fulfilling its save.
        // Once it fulfills, the credential is committed even if cancellation arrived in this continuation gap.
        settle("complete");
        return new Response("Sign-in complete. You can close this window.", {
          headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" },
        });
      } catch {
        settle("failed");
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
    if (saving)
      return saving.then(
        () => {
          settle("complete");
          setTimeout(() => server.stop(true), 0);
        },
        () => {
          settle("failed");
          void server.stop(true);
        },
      );
    if (status === "pending") {
      settle("failed");
    }
    void server.stop(true);
    return Promise.resolve();
  };
  const expiry = setTimeout(close, 3 * 60_000);
  expiry.unref();
  const url = serviceUrl(origin, "/v1/native-login");
  url.searchParams.set("callback", new URL("/callback", server.url).href);
  url.searchParams.set("state", state);
  return { origin, url: url.href, status: () => status, close };
};
