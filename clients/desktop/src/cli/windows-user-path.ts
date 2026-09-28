import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { updateWindowsPath, type WindowsPathAction } from "./windows-path";

const execute = promisify(execFile);
export const quotePowerShell = (value: string) => `'${value.replaceAll("'", "''")}'`;

export const runWindowsPowerShell = async (script: string, env?: NodeJS.ProcessEnv) => {
  const executable = join(
    process.env.SystemRoot ?? "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const { stdout } = await execute(
    executable,
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(
        `$ErrorActionPreference = 'Stop'\n[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)\n${script}`,
        "utf16le",
      ).toString("base64"),
    ],
    { windowsHide: true, env: { ...process.env, ...env } },
  );
  return stdout.trim();
};

// Notify Explorer so newly opened terminals inherit the changed user environment.
const notifyEnvironment = `
Add-Type -Namespace PromptStudio -Name EnvironmentChange -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
public static extern System.IntPtr SendMessageTimeout(System.IntPtr window, uint message, System.UIntPtr wParam, string lParam, uint flags, uint timeout, out System.UIntPtr result);
'@
$result = [UIntPtr]::Zero
[void][PromptStudio.EnvironmentChange]::SendMessageTimeout([IntPtr]0xffff, 0x1a, [UIntPtr]::Zero, 'Environment', 2, 1000, [ref]$result)
`;

export const updateWindowsUserPath = async (
  directory: string,
  action: WindowsPathAction,
  registryKey = "Environment",
) => {
  const key = quotePowerShell(registryKey);
  const current = JSON.parse(
    await runWindowsPowerShell(`
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey(${key})
$value = ''
$kind = 'ExpandString'
if ($null -ne $key) {
  try {
    $stored = $key.GetValue('Path', $null, [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    if ($null -ne $stored) { $value = [string]$stored; $kind = $key.GetValueKind('Path').ToString() }
  } finally { $key.Dispose() }
}
@{ value = $value; kind = $kind } | ConvertTo-Json -Compress
`),
  ) as { value: string; kind: "String" | "ExpandString" };
  const next = updateWindowsPath(current.value, directory, action);
  if (next === current.value) return;
  // Keep PATH data outside the encoded command, which has a smaller Windows size limit.
  await runWindowsPowerShell(
    `
$key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey(${key})
$next = [string]$env:PSTDIO_DESKTOP_CLI_PATH
try {
  if ($next -eq '') { $key.DeleteValue('Path', $false) }
  else { $key.SetValue('Path', $next, [Microsoft.Win32.RegistryValueKind]::${current.kind}) }
} finally { $key.Dispose() }
${notifyEnvironment}
`,
    { PSTDIO_DESKTOP_CLI_PATH: next },
  );
};
