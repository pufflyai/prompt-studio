import type { BetterAuthPlugin } from "better-auth";
import { addOAuthServerContext, createAuthMiddleware, getOAuthState } from "better-auth/api";
import { digestCredential } from "./credential";
import { readNativeCallback } from "./native-login";

export type NativeLoginAttempt = ReturnType<typeof readNativeCallback>;

export const nativeApprovalId = (sessionId: string, { provider, state, url }: NativeLoginAttempt) =>
  `native-login:${digestCredential(JSON.stringify([sessionId, provider, state, url.href]))}`;

export const nativeLoginApproval: BetterAuthPlugin = {
  id: "native-login-approval",
  hooks: {
    before: [
      {
        matcher: (ctx) => ctx.path === "/sign-in/social" && !ctx.request,
        handler: createAuthMiddleware(async () => {
          // The manager's native login route is the only server-side caller of signInSocial.
          await addOAuthServerContext({ nativeLogin: true });
        }),
      },
    ],
    after: [
      {
        matcher: (ctx) => ctx.path === "/callback/:id" && !!ctx.context.newSession,
        handler: createAuthMiddleware(async (ctx) => {
          const session = ctx.context.newSession?.session;
          const oauth = await getOAuthState();
          if (!session || oauth?.serverContext?.nativeLogin !== true) return;

          const attempt = readNativeCallback(new URL(oauth.callbackURL).searchParams);
          if (ctx.params?.id !== attempt.provider) return;

          // Reuse Better Auth's expiring verification store so any manager replica can consume the approval once.
          await ctx.context.internalAdapter.createVerificationValue({
            identifier: nativeApprovalId(session.id, attempt),
            value: "approved",
            expiresAt: new Date(Date.now() + 3 * 60_000),
          });
        }),
      },
    ],
  },
};
