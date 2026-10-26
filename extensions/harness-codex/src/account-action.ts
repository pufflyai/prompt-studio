import type { HarnessAuthenticationChannel } from "@pstdio/sdk/extensions";
import { createAppServerRpc } from "./app-server-rpc";
import { serverEnvironment } from "./app-server-transport";
import { defaultSpawnProcess, type SpawnDeps } from "./codex-process";

export const runCodexAccountAction = async (
  action: "login" | "logout",
  ctx: HarnessAuthenticationChannel,
  deps: SpawnDeps = { spawnProcess: defaultSpawnProcess },
  method = "chatgpt",
) => {
  ctx.signal.throwIfAborted();
  const child = deps.spawnProcess(["app-server", "--listen", "stdio://"], { env: serverEnvironment() });
  const completed = Promise.withResolvers<void>();
  void completed.promise.catch(() => {});
  let loginId: string | undefined;
  let settled = false;
  const rpc = createAppServerRpc(child, (message) => {
    if (message.method !== "account/login/completed" || !loginId || message.params?.loginId !== loginId) return;
    settled = true;
    if (message.params.success === true) completed.resolve();
    else completed.reject(new Error(String(message.params.error ?? "Codex sign-in failed.")));
  });
  const abort = () => completed.reject(ctx.signal.reason);
  ctx.signal.addEventListener("abort", abort, { once: true });
  const disconnect = () => completed.reject(new Error("Codex closed before sign-in completed."));
  void rpc.finished.then(disconnect, disconnect);
  try {
    await rpc.request(
      "initialize",
      { clientInfo: { name: "pstdio", version: "1" }, capabilities: { experimentalApi: true } },
      undefined,
      ctx.signal,
    );
    rpc.write({ method: "initialized" });
    if (action === "logout") {
      await rpc.request("account/logout", {}, undefined, ctx.signal);
      return { authenticated: false };
    }
    if (method === "api_key") {
      const apiKey = (await ctx.request({ type: "input", title: "OpenAI API key", secret: true })).trim();
      if (!apiKey) throw new Error("Enter an API key.");
      await rpc.request("account/login/start", { type: "apiKey", apiKey }, undefined, ctx.signal);
      return;
    }
    const response = (await rpc.request(
      "account/login/start",
      { type: "chatgptDeviceCode" },
      (value) => {
        const result = value as { loginId?: string };
        loginId = result.loginId;
      },
      ctx.signal,
    )) as { type?: string; verificationUrl?: string; userCode?: string };
    if (!loginId || response.type !== "chatgptDeviceCode" || !response.verificationUrl || !response.userCode)
      throw new Error("Codex did not return a device sign-in link and code.");
    const url = new URL(response.verificationUrl);
    if (url.protocol !== "https:") throw new Error("Codex returned an unsupported sign-in URL.");
    await ctx.emit({ type: "browser", url: url.href, code: response.userCode });
    await completed.promise;
    return { authenticated: true };
  } finally {
    ctx.signal.removeEventListener("abort", abort);
    if (loginId && !settled) {
      await rpc.request("account/login/cancel", { loginId }, undefined, AbortSignal.timeout(3_000)).catch(() => {});
    }
    child.kill();
    await Promise.all([child.onExit, rpc.finished.catch(() => {})]);
  }
};
