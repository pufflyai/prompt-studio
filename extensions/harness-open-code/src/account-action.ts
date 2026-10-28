import type { HarnessAuthenticationChannel, HarnessAuthenticationInput, HarnessContext } from "@pstdio/sdk/extensions";
import { createOpencodeAuthentication } from "./authentication";
import type { OpencodeFetcher } from "./opencode-http";
import { type OpencodeServerStarter, startOpencodeServer } from "./opencode-server-process";

/** Account flows own a server so cancellation also stops native OAuth polling and callbacks. */
export const authenticateOpencode = async (
  ctx: HarnessContext,
  input: HarnessAuthenticationInput,
  channel: HarnessAuthenticationChannel,
  deps: { startServer?: OpencodeServerStarter; fetcher?: OpencodeFetcher } = {},
) => {
  channel.signal.throwIfAborted();
  const host = "127.0.0.1";
  const port = await ctx.net.findFreePort({ host });
  const server = await (deps.startServer ?? startOpencodeServer)({ host, port, signal: channel.signal });
  try {
    await createOpencodeAuthentication({
      fetcher: deps.fetcher ?? fetch,
      withServerUrl: (invoke) => invoke(server.url),
    }).authenticate(input, channel);
  } finally {
    await server.dispose();
  }
};
