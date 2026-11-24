import { chmod, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { type AuthenticationResult, type INetworkModule, LogLevel, PublicClientApplication } from "@azure/msal-node";
import { acquireFileMutationLock } from "pstdio-paths";
import { microsoftSchema, serviceUrl } from "./config";

export async function microsoftIdentity(options: {
  broker: string;
  login?: boolean;
  home?: string;
  announce?: (message: string) => void;
  networkClient?: INetworkModule;
}) {
  const response = await fetch(new URL("/v1/login/microsoft", serviceUrl.parse(options.broker)), {
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Microsoft sign-in is not configured.");
  const config = microsoftSchema.parse(await response.json());
  const directory = join(
    options.home ?? process.env.PSTDIO_HOME ?? join(homedir(), ".pstdio"),
    "cloud-access",
    "microsoft",
  );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const path = join(directory, `${config.tenantId}-${config.clientId}.json`);
  const release = acquireFileMutationLock(path, "Microsoft token cache");
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  try {
    const request = async <T>(
      url: string,
      method: string,
      options?: { headers?: Record<string, string>; body?: string },
    ) => {
      const result = await fetch(url, {
        method,
        headers: options?.headers,
        body: options?.body,
        redirect: "error",
        signal: AbortSignal.timeout(30_000),
      });
      return { headers: Object.fromEntries(result.headers), status: result.status, body: (await result.json()) as T };
    };
    const app = new PublicClientApplication({
      auth: { clientId: config.clientId, authority: `https://login.microsoftonline.com/${config.tenantId}` },
      system: {
        networkClient: options.networkClient ?? {
          sendGetRequestAsync: <T>(url: string, options?: { headers?: Record<string, string> }) =>
            request<T>(url, "GET", options),
          sendPostRequestAsync: <T>(url: string, options?: { headers?: Record<string, string>; body?: string }) =>
            request<T>(url, "POST", options),
        },
        loggerOptions: { loggerCallback: () => {}, piiLoggingEnabled: false, logLevel: LogLevel.Error },
      },
    });
    const cache = app.getTokenCache();
    if (!options.login) {
      try {
        cache.deserialize(await readFile(path, "utf8"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    const scopes = ["openid", "profile", "offline_access"];
    const accounts = await cache.getAllAccounts();
    let result: AuthenticationResult | null = null;
    if (options.login) {
      result = await app.acquireTokenByDeviceCode({
        scopes,
        timeout: 900,
        deviceCodeCallback: (value) => (options.announce ?? console.error)(value.message),
      });
    } else if (accounts.length === 1) {
      // ID tokens can expire before the cached access token. Always refresh identity on renewal.
      result = await app.acquireTokenSilent({ scopes, account: accounts[0]!, forceRefresh: true });
    }
    if (!result?.idToken) throw new Error("Run connect --identity microsoft --login to sign in.");
    await writeFile(temporary, cache.serialize(), { flag: "wx", mode: 0o600 });
    await rename(temporary, path);
    return result.idToken;
  } catch {
    throw new Error("Microsoft sign-in needs attention. Run connect --identity microsoft --login.");
  } finally {
    await rm(temporary, { force: true });
    release();
  }
}
