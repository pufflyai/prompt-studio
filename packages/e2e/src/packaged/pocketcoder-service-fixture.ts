export const startPocketCoderFixture = () => {
  const id = crypto.randomUUID();
  const secret = "pocketcoder-packaged-smoke-credential";
  const messages: { id: number; role: string; content: string }[] = [];
  const prompts: string[] = [];
  let state = "ready";
  let createInput: unknown;
  let idempotencyKey: string | null = null;
  const workspace = () => ({ id, state, change_cursor: 1, reason_code: null, failure: null });
  const create = async (request: Request) => {
    createInput = await request.json();
    idempotencyKey = request.headers.get("Idempotency-Key");
    if (!idempotencyKey) return Response.json({}, { status: 400 });
    return Response.json(workspace(), { status: 201 });
  };
  const send = async (request: Request) => {
    const body = (await request.json()) as { content: string; type: string };
    if (body.type !== "user") return Response.json({}, { status: 400 });
    prompts.push(body.content);
    messages.push({ id: messages.length, role: "user", content: body.content });
    messages.push({ id: messages.length, role: "agent", content: `PocketCoder reply ${prompts.length}` });
    return Response.json({ ok: true });
  };
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      if (request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({}, { status: 401 });
      const path = new URL(request.url).pathname;
      if (path === "/v1/templates")
        return Response.json({ items: [{ name: "pi-harness", version: "1", digest: "sha256:abc", status: "active" }] });
      if (path === "/v1/workspaces" && request.method === "POST") return create(request);
      if (path === `/v1/workspaces/${id}/agent/message` && request.method === "POST") return send(request);
      if (path === `/v1/workspaces/${id}/agent/messages`) return Response.json({ messages });
      if (path === `/v1/workspaces/${id}/agent/status`) return Response.json({ status: "stable" });
      if (path === `/v1/workspaces/${id}/cancel` && request.method === "POST") {
        state = "canceled";
        return Response.json(workspace());
      }
      if (path === `/v1/workspaces/${id}`) return Response.json(workspace());
      return Response.json({}, { status: 404 });
    },
  });
  return { server, secret, prompts, id, created: () => ({ input: createInput, idempotencyKey }), state: () => state };
};
