// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./api-D3Fkqs7r.ts";
// node_modules/.bun/@tanstack+react-query@5.90.21+b1ab299f0a400331/node_modules/@tanstack/react-query/build/modern/queryOptions.js
function t(e) {
	return e;
}
// packages/pstdio-dashboard/src/shared/workspaces/workspace-providers.ts
var n = (e) => ["workspace-providers", e], r = async (e, t) => {
	let r = n(t);
	await e.cancelQueries({ queryKey: r }), await e.invalidateQueries({ queryKey: r });
}, i = (r) => {
	let i = e();
	return t({
		queryKey: n(r),
		queryFn: async ({ signal: e }) => r ? i.workspaces.listProviders(r, { signal: e }) : [],
		enabled: !!r,
		staleTime: 0,
		retry: !1
	});
};
export { t as i, n, i as r, r as t };
