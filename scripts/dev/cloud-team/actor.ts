export {};

// Runs only via kubectl exec in an owned Cloud Workspace. Runtime credentials never leave it.
const config = await Bun.file("/workspace/cloud-team/config.json").json();
const input = await Bun.stdin.json();
if (input.callback) {
  const url = new URL(input.callback);
  if (url.hostname !== "127.0.0.1" || url.protocol !== "http:" || url.pathname !== "/callback")
    throw new Error("Invalid native callback");
  const response = await fetch(url, { redirect: "error" });
  if (!response.ok) throw new Error(`Native callback failed (${response.status})`);
  console.log(JSON.stringify({ ok: true }));
} else if (input.control) {
  const response = await fetch(`http://127.0.0.1:8445${input.path}`, {
    method: input.method,
    headers: { authorization: `Bearer ${config.controlToken}`, "content-type": "application/json" },
    body: JSON.stringify(input.body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Fixture control failed (${response.status})`);
  console.log(await response.text());
} else {
  const runtime = await Bun.file("/workspace/cloud-team/home/.pstdio/runtime.json").json();
  const response = await fetch(`http://127.0.0.1:3030${input.path}`, {
    method: input.method,
    headers: {
      authorization: `Bearer ${runtime.token}`,
      origin: "http://127.0.0.1:3030",
      "content-type": "application/json",
    },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    signal: AbortSignal.timeout(120_000),
  });
  const text = await response.text();
  console.log(JSON.stringify({ status: response.status, body: text ? JSON.parse(text) : null }));
}
