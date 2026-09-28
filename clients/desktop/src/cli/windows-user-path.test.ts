import { expect, test } from "bun:test";
import { quotePowerShell, runWindowsPowerShell, updateWindowsUserPath } from "./windows-user-path";

const directory = "C:\\Users\\Person's Å & %test% !\\PromptStudio\\bin";
const original = `%USERPROFILE%\\bin;${Array.from({ length: 700 }, (_, i) => `C:\\Tool ${i}`).join(";")}`;

for (const action of ["install", "uninstall"] as const) {
  test.skipIf(process.platform !== "win32")(
    `Windows PATH ${action} preserves long values and environment references`,
    async () => {
      const registryKey = `Software\\PromptStudioTests\\${crypto.randomUUID()}`;
      const key = quotePowerShell(registryKey);
      const installed = `${original};${directory}`;
      try {
        await runWindowsPowerShell(
          `
$key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey(${key})
$key.SetValue('Path', $env:PSTDIO_TEST_USER_PATH, [Microsoft.Win32.RegistryValueKind]::ExpandString)
$key.Dispose()
`,
          { PSTDIO_TEST_USER_PATH: action === "install" ? original : installed },
        );
        const read = async () =>
          JSON.parse(
            await runWindowsPowerShell(`
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey(${key})
@{ value = $key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames); kind = $key.GetValueKind('Path').ToString() } | ConvertTo-Json -Compress
$key.Dispose()
`),
          );
        await updateWindowsUserPath(directory, action, registryKey);
        expect(await read()).toEqual({ value: action === "install" ? installed : original, kind: "ExpandString" });
      } finally {
        await runWindowsPowerShell(`[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree(${key}, $false)`);
      }
    },
  );
}

test.skipIf(process.platform !== "win32")("registers a command when no user PATH exists", async () => {
  const registryKey = `Software\\PromptStudioTests\\${crypto.randomUUID()}`;
  const key = quotePowerShell(registryKey);
  try {
    await updateWindowsUserPath(directory, "install", registryKey);
    const stored = JSON.parse(
      await runWindowsPowerShell(`
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey(${key})
ConvertTo-Json -Compress -InputObject $key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
$key.Dispose()
`),
    );
    expect(stored).toBe(directory);
  } finally {
    await runWindowsPowerShell(`[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree(${key}, $false)`);
  }
});
