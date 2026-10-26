import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { runCodexAccountAction } from "./account-action";
import type { SpawnDeps } from "./codex-process";

const peer = (mode: string) => {
  let child: ReturnType<typeof spawn>;
  const spawnProcess: SpawnDeps["spawnProcess"] = () => {
    child = spawn(
      process.execPath,
      [
        "-e",
        `
      const emit = value => process.stdout.write(JSON.stringify(value)+'\\n');
      require('node:readline').createInterface({input:process.stdin}).on('line', line => {
        const message = JSON.parse(line);
        if(message.method==='initialize') emit({id:message.id,result:{}});
        if(message.method==='account/logout') emit({id:message.id,result:{}});
        if(message.method==='account/login/cancel') emit({id:message.id,result:{}});
        if(message.method==='account/login/start') {
          if(message.params.type==='apiKey'&&message.params.apiKey==='fixture-api-key'){emit({id:message.id,result:{type:'apiKey'}});return;}
          if(message.params.type!=='chatgptDeviceCode') { emit({id:message.id,error:{message:'Local browser flow is not allowed in this fixture'}}); return; }
          emit({id:message.id,result:{type:'chatgptDeviceCode',loginId:'owned',verificationUrl:'https://auth.openai.com/codex/device',userCode:'TEST-1234'}});
          emit({method:'account/login/completed',params:{loginId:'other',success:false,error:'Another login'}});
          if(${JSON.stringify(mode)}==='exit') process.exit(0);
          if(${JSON.stringify(mode)}!=='wait') emit({method:'account/login/completed',params:{loginId:'owned',success:${mode !== "expired"},error:${JSON.stringify(mode === "expired" ? "Code expired" : null)}}});
        }
      });
    `,
      ],
      { stdio: "pipe" },
    );
    const onExit = new Promise<{ code: number | null; signal: string | null }>((resolve) =>
      child.once("exit", (code, signal) => resolve({ code, signal })),
    );
    return {
      stdin: child.stdin!,
      stdout: child.stdout!,
      stderr: child.stderr!,
      onExit,
      kill: () => {
        child.kill();
      },
    };
  };
  return { deps: { spawnProcess }, exited: () => child!.exitCode !== null || child!.signalCode !== null };
};

test("device login emits only its browser prompt and waits for its own native completion", async () => {
  const fixture = peer("complete");
  const prompts: unknown[] = [];
  await runCodexAccountAction(
    "login",
    {
      signal: new AbortController().signal,
      request: async () => "",
      emit: async (value) => {
        prompts.push(value);
      },
    },
    fixture.deps,
  );
  expect(prompts).toEqual([{ type: "browser", url: "https://auth.openai.com/codex/device", code: "TEST-1234" }]);
  expect(fixture.exited()).toBe(true);
});

test("cancelling the browser flow stops its native worker", async () => {
  const fixture = peer("wait");
  const controller = new AbortController();
  await expect(
    runCodexAccountAction(
      "login",
      {
        signal: controller.signal,
        request: async () => "",
        emit: async () => {
          controller.abort();
        },
      },
      fixture.deps,
    ),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(fixture.exited()).toBe(true);
});

test("expired codes and a disconnected worker cannot report a successful login", async () => {
  for (const mode of ["expired", "exit"]) {
    const fixture = peer(mode);
    await expect(
      runCodexAccountAction(
        "login",
        { signal: new AbortController().signal, request: async () => "", emit: async () => {} },
        fixture.deps,
      ),
    ).rejects.toThrow();
    expect(fixture.exited()).toBe(true);
  }
});

test("logout completes without a browser prompt", async () => {
  const fixture = peer("complete");
  const prompts: unknown[] = [];
  await runCodexAccountAction(
    "logout",
    {
      signal: new AbortController().signal,
      request: async () => "",
      emit: async (value) => {
        prompts.push(value);
      },
    },
    fixture.deps,
  );
  expect(prompts).toEqual([]);
  expect(fixture.exited()).toBe(true);
});

test("API-key login sends a masked reply directly to the native account store", async () => {
  const fixture = peer("complete");
  const questions: unknown[] = [];
  await runCodexAccountAction(
    "login",
    {
      signal: new AbortController().signal,
      emit: async () => {},
      request: async (prompt) => {
        questions.push(prompt);
        return "fixture-api-key";
      },
    },
    fixture.deps,
    "api_key",
  );
  expect(questions).toEqual([{ type: "input", title: "OpenAI API key", secret: true }]);
  expect(fixture.exited()).toBe(true);
});
