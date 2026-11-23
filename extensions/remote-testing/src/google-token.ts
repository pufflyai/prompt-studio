export type GoogleAuthentication = "application-default" | "gcloud" | "metadata";
type Process = {
  run(input: { command: string[]; timeoutMs: number }): Promise<{ exitCode: number | null; stdout: string }>;
};

export function createGoogleTokenProvider(options: { now?: () => number; fetch?: typeof fetch } = {}) {
  const now = options.now ?? Date.now;
  const fetchToken = options.fetch ?? fetch;
  const cache = new Map<GoogleAuthentication, { value: string; until: number }>();
  return async (mode: GoogleAuthentication, process: Process) => {
    const cached = cache.get(mode);
    if (cached && cached.until > now()) return cached.value;
    if (mode === "metadata") {
      const response = await fetchToken(
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
        {
          headers: { "Metadata-Flavor": "Google" },
          redirect: "error",
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok || response.headers.get("metadata-flavor") !== "Google")
        throw new Error("VM workload credentials are unavailable.");
      const token = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
      if (typeof token.access_token !== "string" || typeof token.expires_in !== "number" || token.expires_in <= 0)
        throw new Error("VM workload credentials are invalid.");
      cache.set(mode, { value: token.access_token, until: now() + Math.max(0, token.expires_in - 60) * 1000 });
      return token.access_token;
    }
    const command = ["gcloud", "auth", "print-access-token"];
    if (mode === "application-default") command.splice(2, 0, "application-default");
    const result = await process.run({ command, timeoutMs: 30_000 });
    if (result.exitCode !== 0 || !result.stdout.trim())
      throw new Error("Google sign-in is unavailable. Sign in using the configured Google authentication method.");
    const value = result.stdout.trim();
    cache.set(mode, { value, until: now() + 30 * 60_000 });
    return value;
  };
}
