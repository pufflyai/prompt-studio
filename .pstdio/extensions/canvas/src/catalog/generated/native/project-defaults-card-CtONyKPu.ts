// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./useQuery-OeRqqLZF.ts";
import { t as n } from "./useMutation-Dy9eufiq.ts";
import { t as r } from "./bot-DyijWSfK.ts";
import { t as i } from "./useTranslation-DvWg4zeU.ts";
import { a, i as o, n as s, r as c, t as l } from "./use-harness-param-defaults-DL_UEl4r.ts";
import { n as u } from "./api-D3Fkqs7r.ts";
import { t as d } from "./use-agents-D6pIYuP8.ts";
import { t as f } from "./use-action-error-DjeAuY1I.ts";
import { t as p } from "./workspace-agent-menu-DHlog8io.ts";
import { Box as m, Card as h, HStack as g, Icon as _, Stack as v } from "@chakra-ui/react";
import { jsx as y, jsxs as b } from "react/jsx-runtime";
import { HarnessParamEditor as x, filterHarnessParamValues as S } from "@pstdio/ui/param-editor";
// packages/pstdio-dashboard/src/shared/projects/project-api.ts
var C = (e) => u().projects.get(e), w = (e, t) => u().projects.update(e, t), T = (e) => ["project-defaults", e], E = (e) => t({
	queryKey: T(e),
	queryFn: () => C(e),
	enabled: !!e
}), D = (t) => {
	let r = e();
	return n({
		mutationFn: (e) => w(t, e),
		onSuccess: (e) => {
			r.setQueryData(T(t), e);
		}
	});
}, O = (e) => {
	let { projectId: t } = e, { showError: n, errorNotice: u, clearError: C } = f(), { t: w } = i("settings"), { data: T = [], isLoading: O } = d(t), { data: k } = E(t), A = D(t), j = T.map((e) => ({
		label: e.name,
		value: e.id
	})), M = k?.default_agent_id ?? "", N = j.some((e) => e.value === M) ? M : "", P = T.find((e) => e.id === N), { data: F = [], isLoading: I } = c(N, {
		enabled: !!N,
		projectId: t
	}), L = k?.default_agent_model ?? "", R = F.some((e) => e.id === L) ? L : o(F, void 0)?.id ?? "", z = F.map((e) => ({
		label: e.label ?? e.id,
		value: e.id,
		description: e.description
	})), B = l(t, N || void 0), V = s(t, N || void 0), H = a(B.data?.schema ?? P?.params, o(F, R)) ?? void 0, U = B.data?.defaults ?? {}, W = S(H, U);
	return /* @__PURE__ */ y(h.Root, {
		size: "sm",
		borderRadius: "0",
		"data-testid": "project-defaults-card",
		children: /* @__PURE__ */ b(h.Body, { children: [u, /* @__PURE__ */ b(v, {
			gap: "sm",
			children: [/* @__PURE__ */ b(g, {
				gap: "4",
				alignItems: "flex-start",
				children: [
					/* @__PURE__ */ y(_, {
						boxSize: "1em",
						fontSize: "2xl",
						flexShrink: "0",
						color: "fg.muted",
						children: /* @__PURE__ */ y(r, {})
					}),
					/* @__PURE__ */ y(m, {
						flex: "1",
						minW: "0",
						children: /* @__PURE__ */ b(v, {
							gap: "1",
							children: [/* @__PURE__ */ y(h.Title, {
								textStyle: "sm",
								children: w("harnessesPanel.defaultModelTitle")
							}), /* @__PURE__ */ y(h.Description, { children: w("harnessesPanel.defaultModelDescription") })]
						})
					}),
					/* @__PURE__ */ y(g, {
						gap: "2",
						flexShrink: "0",
						alignItems: "center",
						children: /* @__PURE__ */ y(p, {
							agentOptions: j,
							selectedAgent: N,
							onSelectAgent: (e) => {
								C(), A.mutate({
									default_agent_id: e,
									default_agent_model: null
								}, { onError: (e) => {
									n({
										title: w("agentRow.failedToSetDefaultHarness"),
										description: e.message
									});
								} });
							},
							modelOptions: z,
							selectedModel: R,
							onSelectModel: (e) => {
								N && (C(), A.mutate({
									default_agent_id: N,
									default_agent_model: e || null
								}, { onError: (e) => {
									n({
										title: w("agentRow.failedToSetDefaultModel"),
										description: e.message
									});
								} }));
							},
							offersModels: P?.supportsModels ?? !0,
							isDisabled: A.isPending,
							isAgentsLoading: O,
							isModelsLoading: I,
							labels: {
								agentSelect: w("agentRow.defaultHarnessSelect"),
								agentUnknown: w("agentRow.defaultHarnessNone"),
								agentLoading: w("agentRow.harnessLoading"),
								modelSelect: w("agentRow.defaultModelSelect"),
								modelNone: w("agentRow.defaultModelNone"),
								modelNoneAvailable: w("agentRow.modelNoneAvailable"),
								modelLoading: w("agentRow.modelLoading"),
								modelSearchPlaceholder: w("agentRow.modelSearch")
							}
						})
					})
				]
			}), /* @__PURE__ */ y(m, {
				opacity: B.isLoading ? .5 : 1,
				"data-testid": "project-run-defaults",
				children: /* @__PURE__ */ y(x, {
					schema: H,
					overrides: W,
					onOverridesChange: (e) => {
						C(), V.mutate({
							...U,
							...e
						}, { onError: (e) => {
							n({
								title: w("harnessesPanel.runDefaultsSaveError"),
								description: e.message
							});
						} });
					},
					disabled: B.isLoading || V.isPending
				})
			})]
		})] })
	});
};
export { D as n, O as t };
