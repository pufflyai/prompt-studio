import { describe, expect, test } from "bun:test";
import { createProcessApi } from "./extension-process-api";

const stream = (value: string) => new Response(value).body!;

describe("createProcessApi", () => {
  test("hides Windows consoles for command probes", async () => {
    const calls: unknown[] = [];
    const api = createProcessApi(((command: string[], options: unknown) => {
      calls.push({ command, options });
      return {
        exited: Promise.resolve(0),
        stderr: stream(""),
        stdout: stream("ok"),
      };
    }) as never);

    const result = await api.run({ command: ["pstdio-probe-not-real", "--version"] });

    expect(result).toEqual({ exitCode: 0, stdout: "ok", stderr: "" });
    expect(calls).toHaveLength(1);
    expect((calls[0] as { command: string[] }).command.join(" ")).toContain("pstdio-probe-not-real");
    expect((calls[0] as { command: string[] }).command.at(-1)).toBe("--version");
    expect((calls[0] as { options: unknown }).options).toEqual(
      expect.objectContaining({ stderr: "pipe", stdout: "pipe", windowsHide: true }),
    );
  });

  test("hides Windows consoles for detached commands", async () => {
    const calls: unknown[] = [];
    const api = createProcessApi(((command: string[], options: unknown) => {
      calls.push({ command, options });
      return { pid: 123, unref() {} };
    }) as never);

    await expect(api.spawnDetached({ command: ["pstdio-probe-not-real", "--version"] })).resolves.toEqual({ pid: 123 });
    expect(calls).toHaveLength(1);
    expect((calls[0] as { command: string[] }).command.join(" ")).toContain("pstdio-probe-not-real");
    expect((calls[0] as { command: string[] }).command.at(-1)).toBe("--version");
    expect((calls[0] as { options: unknown }).options).toEqual(
      expect.objectContaining({ stderr: "ignore", stdout: "ignore", windowsHide: true }),
    );
  });
});
