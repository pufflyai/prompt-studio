# Remote execution extension example

This extension shows the complete remote execution path:

- a named host-managed connection;
- a provider-owned remote workspace reference;
- a harness that does not require a local `cwd`;
- restart-safe `resume`, `reattach`, and message reads;
- one command exposed to scoped external automation.

The control plane owns repository cloning, compute, and agent credentials. Prompt Studio stores only the opaque provider reference and adds the connection credential inside the host.

Configure the connection in **Settings → Extensions → Remote execution example → Connections**. To launch manually, use **Launch remote session** from the project actions or choose it from the command palette. Enter the repository and prompt when asked.

For automation, issue a token in **Settings → Machine tokens** with this exact command scope:

```text
example.remote-execution.command.launch
```

The example control plane contract is illustrative. Starting a session sends the stable Prompt Studio session ID and requires the control plane to use it as the remote ID. Resuming sends a stable request ID built from the host session ID and message offset. The control plane must deduplicate both requests. If either response is lost during cancellation, the harness deletes the known remote session ID. Reattachment only polls the existing session. Replace these paths and response bodies with your service while keeping these idempotency and cleanup rules and a narrow host connection policy.
