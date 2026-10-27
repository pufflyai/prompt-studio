// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { createClient as e } from "@pstdio/sdk/client";
// scripts/design/native-api-fixture.ts
var t = Object.assign(async (e, t) => {
	let n = new Request(e, t), r = new URL(n.url);
	if (r.origin !== "https://canvas.invalid") throw Error(`Missing local preview fixture: ${r.pathname}`);
	let i = r.pathname.match(/^\/v1\/workspaces\/([^/]+)\/diff-summary$/);
	return n.method === "GET" && i ? Response.json({
		workspace_id: i[1],
		additions: 128,
		deletions: 14,
		file_count: 6
	}) : Response.json({ message: `No local fixture for ${n.method} ${r.pathname}` }, { status: 501 });
}, fetch), n = () => ({
	baseUrl: "https://canvas.invalid",
	token: "",
	fetch: t
}), r = e(n()), i = () => r, a = () => ({ apiBaseUrl: "https://canvas.invalid" });
export { i as n, a as r, n as t };
