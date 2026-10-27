// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./useQuery-OeRqqLZF.ts";
import { n as t } from "./api-D3Fkqs7r.ts";
// packages/pstdio-dashboard/src/shared/agents/load-agents.ts
var n = async (e, t, n) => {
	let r = [], i;
	do {
		n?.throwIfAborted();
		let a = await e.query(t, { cursor: i });
		n?.throwIfAborted(), r.push(...a.items), i = a.nextCursor ?? void 0;
	} while (i);
	return r;
}, r = (r) => e({
	queryKey: ["agents-info", r ?? "all"],
	queryFn: ({ signal: e }) => n(t().agents, r, e),
	refetchInterval: 15e3
});
export { r as t };
