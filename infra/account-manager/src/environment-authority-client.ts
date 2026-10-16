import {
  type EnvironmentAuthorityClientConfig,
  type EnvironmentAuthorityTransport,
  environmentAuthorityClientSchema,
  environmentAuthorityPath,
  environmentAuthorityRequestSchema,
  environmentAuthorityResponseSchema,
} from "./environment-authority-contracts";

export type {
  EnvironmentAuthorityClientConfig,
  EnvironmentAuthorityTransport,
} from "./environment-authority-contracts";

export const createEnvironmentAuthorityClient = (
  input: EnvironmentAuthorityClientConfig,
  transport: EnvironmentAuthorityTransport = fetch,
) => {
  const config = (() => {
    try {
      return environmentAuthorityClientSchema.parse(input);
    } catch {
      throw new Error("Environment authority configuration is invalid");
    }
  })();
  const endpoint = new URL(environmentAuthorityPath, config.origin).href;
  return {
    async authorize(token: string, workbenchId: string) {
      try {
        const intent = environmentAuthorityRequestSchema.parse({ token, workbenchId });
        const response = await transport(endpoint, {
          method: "POST",
          headers: { authorization: `Bearer ${config.serviceSecret}`, "content-type": "application/json" },
          body: JSON.stringify(intent),
          redirect: "error",
          signal: AbortSignal.timeout(config.requestTimeoutMs),
        });
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error("Environment authority request failed");
        }
        const result = environmentAuthorityResponseSchema.parse(await response.json());
        if (result.identity && result.identity.workbenchId !== intent.workbenchId)
          throw new Error("Environment authority scope mismatch");
        return result.identity;
      } catch {
        throw new Error("Environment authority request failed");
      }
    },
  };
};
