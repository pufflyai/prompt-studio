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

- On macOS, drag the app to Applications and open it from there. When the app starts, it links `~/.pstdio/bin/pst` to its bundled CLI and adds that folder to your `PATH` in your shell's startup file (`~/.zshrc`, `~/.bash_profile`, or `~/.config/fish/config.fish`). It never asks for a password. Open a new terminal window before you use `pst`.
- On Linux, the `.deb` package installs the app and `/usr/bin/pst`. For the portable `.zip`, extract it to a folder whose path has no spaces, then run `prompt-studio` from that folder. The portable app sets up `~/.pstdio/bin/pst` the same way as on macOS, using `~/.bashrc` for bash.
- On Windows, run the Setup installer. It does not need an administrator password. It adds `pst` to your `PATH`. Close and reopen your terminal before you use it.

Check the command:

```sh
pst --version
```

If an older `pst` is already installed, the app keeps it. Remove the other installation, then install the command again from the app. Run `command -v pst` on macOS or Linux, or `where.exe pst` on Windows, to see which one runs.

### Update the app

On macOS and Windows, the app checks for updates when it starts and every four hours. When an update has downloaded, the app tells you. It installs when you quit the app. To check now, choose **Prompt Studio → Check for Updates…** on macOS or **Help → Check for Updates…** on Windows.

Linux has no built-in updater. **Help → Check for Updates…** opens the page of the newest release for your update channel. Update the `.deb` with your package manager, or download a new portable build.

### Choose an update channel

On macOS and Linux, the desktop app can follow one of two update channels:

- **Stable** installs released versions. This is the default.
- **Nightly** installs a signed build of the latest `main` branch. A new nightly is published once a day when `main` changed. Nightlies can have bugs, and they run new database migrations on your data.

Choose the channel in **Settings → Workbench → Update channel**, or run:

```sh
pst update-channel nightly
pst update-channel stable
pst update-channel        # prints the current channel
```

The choice belongs to this computer. The app never installs an older version. If you switch from Nightly back to Stable, the app keeps the nightly build until a newer stable release is out. Windows always follows Stable.

## Install only the command-line tool

If you have [Bun](https://bun.sh), install the `pstdio` package globally:

```sh
bun add --global pstdio@latest
pst --version
```

The package installs two names for the same command: `pst` and `pstdio`.

To follow nightly builds of the command-line tool, install `pstdio@nightly` instead. Each nightly GitHub release also has an `install.sh` that installs that nightly.

## Start Prompt Studio

Open the desktop app, or run:

```sh
pst
```

`pst` starts Prompt Studio in the background and opens the dashboard in your browser. It prints the dashboard address. To print the address without opening a browser, run `pst --open-browser false`.

The dashboard only answers on the loopback address that `pst` prints, such as `http://127.0.0.1:<port>`. It refuses other host names and other machines on your network.

The desktop app and `pst` share one background runtime. They show the same projects. See [runtime commands](../../references/cli/0003-setup.md) for how the runtime starts and stops.

Next, [open a project](0002-open-a-project.md).
