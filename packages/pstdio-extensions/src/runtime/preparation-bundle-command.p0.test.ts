import { expect, test } from "bun:test";
import { captureBundleCommand } from "./preparation-bundle-command";

test("a bundle result received before its deadline stays successful through slower cleanup", async () => {
  const result = await captureBundleCommand(
    {
      argv: [
        process.execPath,
        "-e",
        "process.on('message', () => {}); process.send({ kind: 'bundle-result', ok: true });",
      ],
      env: {},
      stdin: "",
      deadlineMs: 1_000,
    },
    (argv, options) => {
      const child = Bun.spawn(argv, options);
      return {
        child,
        startFailure: undefined,
        async stop() {
          child.kill();
          await child.exited;
          await Bun.sleep(1_050);
        },
      };
    },
  );
  expect(result.outcome).toEqual({ kind: "bundle-result", ok: true });
  expect(result.timedOut).toBe(false);
});
