import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPiAccountWorker } from "./authentication";

const fixture = async () => {
  const root = mkdtempSync(join(tmpdir(), "pi-account-"));
  await Bun.write(
    join(root, "extensions/browser.ts"),
    `export default pi=>{console.log('Native extension loaded');pi.registerProvider('fixture-browser',{oauth:{name:'Fixture browser',usesCallbackServer:true,login:async callbacks=>{
    callbacks.onAuth({url:'https://example.test/login'});
    if(process.env.PSTDIO_PI_AUTH_WAIT)await callbacks.onPrompt({message:'Verification code'});
    else void callbacks.onManualCodeInput?.().catch(()=>{});
    return {access:'fixture-access',refresh:'fixture-refresh',expires:Date.now()+60000};
  },refreshToken:async credentials=>credentials,getApiKey:credentials=>credentials.access}});};`,
  );
  return {
    root,
    options: { cwd: root, env: { PI_CODING_AGENT_DIR: root, PI_SKIP_VERSION_CHECK: "1", PATH: "/usr/bin:/bin" } },
    close: () => rmSync(root, { recursive: true, force: true }),
  };
};

test("native Pi browser completion wins over a pending manual-code prompt", async () => {
  const { root, options, close } = await fixture();
  let asked = false;
  try {
    await runPiAccountWorker(
      { type: "authenticate", input: { action: "login", provider: "fixture-browser", method: "oauth" } },
      options,
      {
        signal: new AbortController().signal,
        emit: async () => {},
        request: () => {
          asked = true;
          return new Promise(() => {});
        },
      },
    );
    expect(asked).toBe(true);
    expect((await Bun.file(join(root, "auth.json")).json())["fixture-browser"]).toMatchObject({
      type: "oauth",
      access: "fixture-access",
    });
    expect((await runPiAccountWorker({ type: "status", model: "fixture-browser/test" }, options))?.status).toBe(
      "signed_in",
    );
  } finally {
    close();
  }
});

test("cancelling Pi login stops its worker before it can save credentials", async () => {
  const { root, options, close } = await fixture();
  const ready = Promise.withResolvers<void>();
  const controller = new AbortController();
  try {
    const operation = runPiAccountWorker(
      { type: "authenticate", input: { action: "login", provider: "fixture-browser", method: "oauth" } },
      { ...options, env: { ...options.env, PSTDIO_PI_AUTH_WAIT: "1" } },
      {
        signal: controller.signal,
        emit: async () => {},
        request: () => {
          ready.resolve();
          return new Promise(() => {});
        },
      },
    );
    const result = operation.catch((error) => error);
    await ready.promise;
    controller.abort();
    expect(await result).toMatchObject({ name: "AbortError" });
    expect((await Bun.file(join(root, "auth.json")).json())["fixture-browser"]).toBeUndefined();
  } finally {
    close();
  }
});
