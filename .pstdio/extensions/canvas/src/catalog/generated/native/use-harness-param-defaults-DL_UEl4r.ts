// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./useQuery-OeRqqLZF.ts";
import { t as n } from "./useMutation-Dy9eufiq.ts";
import { n as r } from "./api-D3Fkqs7r.ts";
import { PstdioApiError as i } from "@pstdio/sdk/client";
// packages/pstdio-api-contracts/src/agent-model-params.ts
var a = (e, t) => t ? e.find((e) => e.id === t) : e.find((e) => e.isDefault) ?? e[0], o = (e, t) => {
	if (!e) return null;
	let n = { ...e };
	for (let [e, r] of Object.entries(t?.paramOverrides ?? {})) r ? n[e] = r : delete n[e];
	return n;
}, s = (e, n) => t({
	queryKey: [
		"agent-models",
		e,
		n?.projectId ?? "all"
	],
	queryFn: () => r().agents.models(e, n?.projectId),
	enabled: n?.enabled ?? !0,
	retry: (e, t) => !(t instanceof i && t.status === 404) && e < 3
}), c = (e, t, n) => [
	"harness-param-defaults",
	e ?? "",
	t ?? "",
	n ?? ""
], l = (e, n, i) => t({
	queryKey: c(e, n, i),
	enabled: !!(e && n),
	queryFn: () => r().agents.getParamDefaults(e, n, i)
}), u = (t, i) => {
	let a = e();
	return n({
		mutationFn: (e) => r().agents.setParamDefaults(t, i, e),
		onSuccess: (e) => {
			a.setQueryData(c(t, i), e), a.invalidateQueries({ queryKey: [
				"harness-param-defaults",
				t ?? "",
				i ?? ""
			] });
		}
	});
};
export { o as a, a as i, u as n, s as r, l as t };
