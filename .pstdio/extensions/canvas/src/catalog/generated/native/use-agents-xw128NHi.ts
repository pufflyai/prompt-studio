// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./useQuery-OeRqqLZF.ts";
import { n as t } from "./api-D3Fkqs7r.ts";
// packages/pstdio-dashboard/src/shared/agents/use-agents.ts
var n = (n) => e({
	queryKey: ["agents-info", n ?? "all"],
	queryFn: () => t().agents.info({ project: n })
});
export { n as t };
