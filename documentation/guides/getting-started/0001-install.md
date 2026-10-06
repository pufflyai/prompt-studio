# Install Prompt Studio

Install the desktop app, or install only the `pst` command-line tool. Both run the same Prompt Studio on your computer.

Prompt Studio is in alpha. Try new builds and new extensions in a project you can throw away.

## Install the desktop app

Download the app from [prompt.studio](https://prompt.studio). The site offers the build for your computer. Every build is also listed on the [GitHub releases page](https://github.com/pufflyai/prompt-studio/releases).

| Computer | File to download |
| --- | --- |
| Mac with Apple silicon | `Prompt-Studio-<version>-darwin-arm64.dmg` |
| Mac with an Intel processor | `Prompt-Studio-<version>-darwin-x64.dmg` |
| Linux x64 | `Prompt-Studio-<version>-linux-x64.deb`, or the portable `.zip` |
| Windows x64 | `Prompt-Studio-<version>-win32-x64-Setup.exe` |

The app includes the `pst` command. You do not need Bun, Node.js, or a separate CLI download.

- On macOS, drag the app to Applications and open it from there. On the first launch, the app adds the `pst` command at `/usr/local/bin/pst`. macOS may ask for an administrator password. If you cancel, choose **Prompt Studio → Install pst Command…** later.
- On Linux, the `.deb` package installs the app and `/usr/bin/pst`. For the portable `.zip`, extract it to a folder whose path has no spaces, then run `prompt-studio` from that folder. The portable build does not add `pst`.
- On Windows, run the Setup installer. It does not need an administrator password. It adds `pst` to your `PATH`. Close and reopen your terminal before you use it.

Check the command:

```sh
pst --version
```

If an older `pst` is already installed, the app keeps it. Remove the other installation, then install the command again from the app. Run `command -v pst` on macOS or Linux, or `where.exe pst` on Windows, to see which one runs.

### Update the app

On macOS, choose **Prompt Studio → Check for Updates…**. On Windows, choose **Help → Check for Updates…**. A downloaded update installs when you quit the app.

Linux has no built-in updater. **Help → Check for Updates…** opens the releases page. Update the `.deb` with your package manager, or download a new portable build.

## Install only the command-line tool

If you have [Bun](https://bun.sh), install the `pstdio` package globally:

```sh
bun add --global pstdio@latest
pst --version
```

The package installs two names for the same command: `pst` and `pstdio`.

## Start Prompt Studio

Open the desktop app, or run:

```sh
pst
```

`pst` starts Prompt Studio in the background and opens the dashboard in your browser. It prints the dashboard address. To print the address without opening a browser, run `pst --open-browser false`.

The dashboard only answers on the loopback address that `pst` prints, such as `http://127.0.0.1:<port>`. It refuses other host names and other machines on your network.

The desktop app and `pst` share one background runtime. They show the same projects. See [runtime commands](../../references/cli/0003-setup.md) for how the runtime starts and stops.

Next, [open a project](0002-open-a-project.md).
