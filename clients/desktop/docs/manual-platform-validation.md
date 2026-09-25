# Manual desktop checks without local target hardware

Use a remote desktop on the target architecture. The computer you connect from can be an Apple Silicon Mac. Run the checks inside the remote machine.

- Windows: use an x64 Windows desktop or cloud PC. Microsoft [Windows App](https://learn.microsoft.com/en-us/windows-app/get-started-connect-devices-desktops-apps) connects from macOS. Choose a desktop image with a graphical session and permission to install applications.
- Intel macOS: use a hosted Intel Mac with a graphical login and administrator access. Confirm the processor before booking; a provider's generic “Mac” plan can be Apple Silicon. [MacinCloud documents remote desktop access](https://support.macincloud.com/support/solutions/articles/8000079292-how-to-connect-to-macincloud-dedicated-server-using-rdp).

An ARM Windows VM running the x64 application, or Rosetta on an Apple Silicon Mac, can provide extra compatibility checks. Neither measures startup on the native x64 machines required by the release gate.

## Confirm the machine

On Windows, open PowerShell:

```powershell
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, OSArchitecture
Get-CimInstance Win32_Processor | Select-Object Name, Architecture
```

The operating system must be 64-bit and the processor architecture must be `9` (x64).

On the remote Mac, open Terminal:

```sh
uname -m
sysctl -n machdep.cpu.brand_string
sw_vers
```

Require `x86_64` and an Intel processor. Record the OS version and machine type with the results.

## Get the matching build

Use the commit and artifact named in the change request or PR. GitHub Actions readiness artifacts contain test results, screenshots, and redacted traces; they are evidence, not installers. Download an installer only from a run that explicitly supplies a desktop candidate or from the official GitHub release.

Release candidates and published releases are different. An unsigned Windows development package can check application behavior, but it cannot prove trusted installation or the signed update path. Do not record it as a passed release check.

For a Windows development artifact, extract the entire ZIP to one directory, keep its `resources` directory beside `Prompt Studio.exe`, and run that executable. Follow the application checks below and record installation, signature, and update checks as pending.

For a published release, download the Intel `darwin-x64` DMG or the Windows `win32-x64-Setup.exe` from the same version. Compare its SHA-256 with that release's checksum file.

```powershell
Get-FileHash .\Prompt-Studio-VERSION-win32-x64-Setup.exe -Algorithm SHA256
Get-AuthenticodeSignature .\Prompt-Studio-VERSION-win32-x64-Setup.exe |
  Format-List Status, StatusMessage, SignerCertificate
```

```sh
shasum -a 256 Prompt-Studio-VERSION-darwin-x64.dmg
```

Windows release signatures must report `Valid`. After installing on macOS, verify the application:

```sh
codesign --verify --deep --strict --verbose=2 '/Applications/Prompt Studio.app'
xcrun stapler validate '/Applications/Prompt Studio.app'
spctl --assess --type execute --verbose=2 '/Applications/Prompt Studio.app'
```

## Install and use the app

Use a fresh test account or a disposable remote machine. Keep the account through the update check.

1. Install through the DMG or Setup installer and launch from Finder or the Windows Start menu. Record the installer behavior and the version shown in About.
2. Confirm the startup screen and workbench appear. Create a test project and check that the default extensions load.
3. Create a second project, switch between project tabs, close one tab, and reopen it. Check that every tab responds to clicks.
4. Create a ticket and a workspace. Edit and save a small file. Open a terminal and run a command that prints the working directory.
5. If an agent is installed, confirm it appears in the harness selector and run a short session. On Windows, launch the app from the Start menu after installing the agent so the test exercises the user's normal executable search path.
6. Quit the app through its native menu. Confirm any active-work prompt is accurate, confirm stopping that test work, and check that the app exits.
7. Relaunch from Finder or Start. Confirm the project, ticket, file contents, and tabs persist. Repeat after signing out and back in.
8. Save screenshots and the exact build, OS, CPU, and observed results in the change request report. Record a failure at the step that produced it.

For the background-runtime check, use the CLI bundled with this exact desktop build. On macOS it is `/Applications/Prompt Studio.app/Contents/Resources/bin/pstdio`. On Windows it is `resources\bin\pstdio.exe` inside the installed application's directory. Open that directory from the running application's location, rather than guessing a versioned installation path.

Run that executable with `--version`, then with `serve` while the desktop is open. Quit the desktop, run it with `projects list`, and confirm the same project is still available. Reopen the desktop, then run it with `close` to stop the runtime. Startup diagnostics include `desktop-runtime.log` beside `runtime.json` in the Prompt Studio home; each new runtime launch replaces that file.

Remote desktop video latency is not a startup measurement. Use the native Playwright `packaged-release-readiness.json` annotations for cold workbench, startup-window, warm attachment, and recovery timing.

## Test the updater

This requires two different, compatible signed versions on the target platform. A first Windows release has no earlier published Windows build, so a published-to-published check is possible only after a second Windows release exists. Record that gap explicitly; an unsigned package pair does not close it.

1. Install the older signed version and create the test data above.
2. Record its About version and the bundled CLI version.
3. Choose **Check for Updates…** and capture the result. Confirm a newer version is downloaded.
4. Quit normally when the update is ready, then reopen the app.
5. Confirm About and the bundled CLI both show the new version and all test data survives.
6. Verify the updated application signature. On Windows, also verify the bundled `resources\bin\pstdio.exe` signature. On macOS, rerun the three application checks above.
7. Check for updates again. Confirm the app reports that it is current.

Keep the older installer and test account until the results are reviewed. When finished, remove only the disposable test machine or account and its test data.
