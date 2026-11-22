# Privacy and safety

Keys you store in a connection stay with Prompt Studio, and tool pages only reach what they declare.

## What Prompt Studio protects

Prompt Studio runs on your computer. Your tools are extensions, and their code runs inside the Prompt Studio runtime with the access of your user account. Some limits apply to every tool:

- **Connections keep keys out of tool code.** A tool that calls a remote service declares a named connection. You enter the endpoint and credential once. The tool can send requests through the connection but never receives the credential.
- **Tool pages only reach what they declare.** A custom page (a webview) can only call the host features it lists, such as opening a page or reading one storage folder. Any other call is refused.
- **Installing a tool does not run its install scripts.** Prompt Studio installs dependencies with lifecycle scripts turned off, for the tool and for every dependency.
- **Links do not share content.** Linking two items records that they belong together. It does not give either tool access to the other's data.
- **Device settings stay on the device.** A setting a tool declares for one device is never added to synced project data.

These limits do not sandbox a tool's own code. An installed extension can read your files, the API keys in the environment that started Prompt Studio, and the connection secrets Prompt Studio stores. Install extensions only from sources you trust.

## Stay safe in Prompt Studio

- **Check repo extensions.** A project folder can bring its own extensions in `.pstdio/extensions`, and they run as soon as you open the folder. Open folders from people you trust, or check that folder first.
- **Store keys in connections.** Open **Extensions**, choose the tool, and use the **Connections** card in its **Settings** tab. Enter the **Endpoint** and **Credential**, then choose **Connect**. **Check** runs the tool's declared health check, and **Revoke** removes the stored credential. The host keeps the credential in a file that only your user account can read.
- **Limit automation.** A machine token works for one project, only for the commands you list, and only until it expires. Issue one with `pst auth tokens`.

To run a connection's health check from the terminal:

```sh
pst connections check --project <project-id> --extension <extension-id> --connection <connection-id>
```

## Build a safe tool

Declare remote access with `defineConnection` and list it in `defineExtension({ connections })`. Name the `allowedMethods` and `allowedPathPrefixes` the tool needs, and add a `check` request for the health check. Call the service with `ctx.connections.request(id, { method, path })` or `ctx.connections.stream(...)`. The host rejects other methods, paths outside the prefixes, cross-origin redirects, and plain HTTP outside local development.

Give each webview only the capabilities it uses, such as `navigation.open` or `artifactsRead(mount)`. A missing declaration fails with the `undeclared_webview_capability` error, which names the capability. Store project data through the storage API or declared artifact mounts, not in arbitrary folders.

Mark a command with `automation: true` only when a scoped machine token should be able to run it.

## Learn more

- [Extensions](../concepts/0002-extensions.md#trust) explains what an installed extension can access.
- [Named connections](../../references/extensions/0003-command-and-process-api.md#named-connections) shows a full `defineConnection` example.
- [Webviews and storage](../../references/extensions/0005-webview-and-storage-api.md#host-context-and-capability-errors) covers capability errors.
- [Manifest and installation](../../references/extensions/0002-manifest-and-installation.md#trust) describes how extensions are installed and loaded.
- [Remote automation](../../references/cli/0007-automation.md) covers machine tokens.

*Updated at: 2026-11-22*
