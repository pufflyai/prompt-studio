import type { createAccountManager } from "./authority";
import type { BeginLoginInput } from "./contracts";
import {
  type GoogleCodeCompletionInput,
  type GoogleLoginConfig,
  type GoogleTransport,
  googleCodeCompletionSchema,
  googleLoginConfigSchema,
  googleTokenResponseSchema,
} from "./google-code-contracts";
import { createGoogleIdentityVerifier } from "./google-identity";

const readConfig = (input: GoogleLoginConfig) => {
  try {
    return googleLoginConfigSchema.parse(input);
  } catch {
    // URL and validation errors can retain sensitive configuration input.
    throw new Error("Google login configuration is invalid");
  }
};

export const createGoogleLogin = (
  manager: ReturnType<typeof createAccountManager>,
  input: GoogleLoginConfig,
  transport: GoogleTransport = fetch,
) => {
  const config = readConfig(input);
  const verify = createGoogleIdentityVerifier(config.clientId, transport);
  return {
    async begin(intent: BeginLoginInput) {
      const challenge = await manager.beginLogin(intent);
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: "code",
        scope: "openid",
        state: challenge.state,
        nonce: challenge.nonce,
        code_challenge: new Bun.CryptoHasher("sha256").update(challenge.binding).digest("base64url"),
        code_challenge_method: "S256",
      }).toString();
      return { authorizationUrl: url.href, binding: challenge.binding };
    },
    async complete(input: GoogleCodeCompletionInput) {
      try {
        const intent = googleCodeCompletionSchema.parse(input);
        const pending = await manager.loginChallenge(intent.state, intent.binding);
        if (!pending) throw new Error("Login challenge is unavailable");
        const response = await transport("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: config.redirectUri,
            grant_type: "authorization_code",
            code: intent.code,
            code_verifier: intent.binding,
          }),
          redirect: "error",
          signal: AbortSignal.timeout(config.exchangeTimeoutMs),
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error("Google code exchange failed");
        }
        const token = googleTokenResponseSchema.parse(await response.json());
        const owner = await verify(token.id_token, pending.nonce);
        return await manager.completeLogin({
          state: intent.state,
          binding: intent.binding,
          accountId: intent.accountId,
          expiresAt: intent.expiresAt,
          owner,
        });
      } catch {
        throw new Error("Google login failed");
      }
    },
  };
};
