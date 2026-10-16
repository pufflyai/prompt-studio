import { createHash, timingSafeEqual } from "node:crypto";
import type { createAccountManager } from "./authority";
import {
  type EnvironmentAuthorityServiceConfig,
  environmentAuthorityPath,
  environmentAuthorityRequestSchema,
  environmentAuthorityResponseSchema,
  environmentAuthorityServiceSchema,
} from "./environment-authority-contracts";

const digest = (value: string) => createHash("sha256").update(value).digest();
const reply = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

export const createEnvironmentAuthorityHandler = (
  manager: Pick<ReturnType<typeof createAccountManager>, "authorize">,
  input: EnvironmentAuthorityServiceConfig,
) => {
  const expected = (() => {
    try {
      return digest(environmentAuthorityServiceSchema.parse(input).serviceSecret);
    } catch {
      throw new Error("Environment authority configuration is invalid");
    }
  })();
  return async (request: Request) => {
    const reject = async (status: number) => {
      await request.body?.cancel().catch(() => {});
      const response = reply(status, { error: "Environment authority request rejected" });
      if (status === 401) response.headers.set("www-authenticate", 'Bearer realm="environment-authority"');
      if (status === 405) response.headers.set("allow", "POST");
      return response;
    };
    try {
      if (new URL(request.url).pathname !== environmentAuthorityPath) return await reject(404);
      if (request.method !== "POST") return await reject(405);
      const secret = /^Bearer +(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
      if (!secret || !timingSafeEqual(expected, digest(secret))) return await reject(401);
      const intent = await (async () => {
        try {
          return environmentAuthorityRequestSchema.parse(await request.json());
        } catch {
          return null;
        }
      })();
      if (!intent) return reply(400, { error: "Environment authority request rejected" });
      const identity = await manager.authorize(intent.token, intent.workbenchId);
      return reply(200, environmentAuthorityResponseSchema.parse({ identity }));
    } catch {
      return reply(503, { error: "Environment authority is unavailable" });
    }
  };
};
