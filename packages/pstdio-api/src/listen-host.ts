const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export const isLoopbackHost = (host: string) => LOOPBACK_HOSTS.has(host.toLowerCase());

// Without a token the API trusts every client that can reach it, so it may only be reachable from
// this machine. A container that publishes its port to host loopback still listens on all of its
// own interfaces, so it needs a token too.
export const assertListenHostAllowed = (host: string, token: string | undefined) => {
  if (token || isLoopbackHost(host)) return;
  throw new Error(`Refusing to listen on ${host} without an API token. Listen on 127.0.0.1, or set PSTDIO_API_TOKEN.`);
};
