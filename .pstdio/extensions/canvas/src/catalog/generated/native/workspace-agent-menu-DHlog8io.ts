// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-down-ZmPqsMG0.ts";
import { t } from "./cpu-DJuq_2-_.ts";
import { t as n } from "./terminal-B2gAfUK-.ts";
import { t as r } from "./useTranslation-DvWg4zeU.ts";
import { Box as i, Button as a, Icon as o, Menu as s, Text as c } from "@chakra-ui/react";
import { ListRow as l, SearchableMenu as u, Tooltip as d } from "@pstdio/ui";
import { jsx as f, jsxs as p } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/shared/components/workspace-agent-menu.tsx
var m = (e, t, n, r) => t ? e.find((e) => e.value === t)?.label ?? r : n, h = (e, t, r, i) => r ? [{
	id: "agent-loading",
	label: i.agentLoading,
	icon: n,
	isDisabled: !0
}] : e.length === 0 ? [{
	id: "agent-none-available",
	label: i.agentUnknown,
	icon: n,
	isDisabled: !0
}] : e.map((e) => ({
	id: e.value,
	label: e.label,
	searchText: e.value,
	secondaryLabel: e.description,
	icon: e.icon ?? n,
	isSelected: e.value === t,
	isDisabled: e.disabled
})), g = (e, n, r, i, a) => r ? [{
	id: "model-loading",
	label: a.modelLoading,
	icon: t,
	isDisabled: !0
}] : e.map((e) => ({
	id: e.value,
	label: e.label,
	secondaryLabel: e.description,
	searchText: `${e.value} ${e.description ?? ""}`,
	isSelected: e.value === n,
	onSelect: () => i(e.value)
})), _ = (t) => {
	let { label: n, ariaLabel: r, tooltip: i, disabled: o, size: s } = t;
	return /* @__PURE__ */ f(d, {
		content: i,
		children: /* @__PURE__ */ p(a, {
			variant: "ghost",
			size: s,
			px: "2",
			"aria-label": r,
			disabled: o,
			children: [/* @__PURE__ */ f(c, {
				textStyle: "label/XS/medium",
				color: "fg",
				children: n
			}), /* @__PURE__ */ f(e, { size: 14 })]
		})
	});
}, v = (e) => {
	let { agentOptions: a, selectedAgent: c, onSelectAgent: d, modelOptions: p, selectedModel: v, onSelectModel: y, offersModels: b = !0, isDisabled: x = !1, isAgentSwitchDisabled: S = !1, shouldDisableSingleAgentSwitch: C = !0, isAgentsLoading: w = !1, isModelsLoading: T = !1, labels: E, portalled: D = !0, size: O = "sm" } = e, { t: k } = r("projects"), A = {
		agentSelect: E?.agentSelect ?? k("chatInput.agent.selectLabel"),
		agentUnknown: E?.agentUnknown ?? k("chatInput.agent.unknown"),
		agentLoading: E?.agentLoading ?? k("chatInput.agent.loading"),
		modelSelect: E?.modelSelect ?? k("chatInput.model.selectLabel"),
		modelNone: E?.modelNone ?? k("chatInput.model.none"),
		modelNoneAvailable: E?.modelNoneAvailable ?? k("chatInput.model.noneAvailable"),
		modelLoading: E?.modelLoading ?? k("chatInput.model.loading"),
		modelSearchPlaceholder: E?.modelSearchPlaceholder ?? k("chatInput.model.searchPlaceholder")
	}, j = a.length === 0 ? A.agentUnknown : m(a, c, A.agentSelect, A.agentUnknown), M = w ? A.agentLoading : j, N = T ? A.modelLoading : m(p, v, A.modelSelect, A.modelNone), P = x || S || C && a.length <= 1, F = x || a.length === 0 && p.length === 0, I = h(a, c, w, A), L = g(p, v, T, y, A), R = /* @__PURE__ */ f(s.Item, {
		value: "empty",
		asChild: !0,
		children: /* @__PURE__ */ f(l, {
			asChild: !0,
			variant: "compact",
			id: "empty",
			label: A.agentUnknown,
			icon: /* @__PURE__ */ f(o, {
				as: n,
				boxSize: "16px"
			}),
			disabled: !0
		})
	});
	return b ? /* @__PURE__ */ f(u, {
		trigger: /* @__PURE__ */ f(i, { children: /* @__PURE__ */ f(_, {
			label: N,
			ariaLabel: A.modelSelect,
			tooltip: F ? A.modelNoneAvailable : A.modelSelect,
			disabled: F,
			size: O
		}) }),
		items: L,
		showSearch: p.length > 5,
		width: "260px",
		portalled: D,
		searchPlaceholder: A.modelSearchPlaceholder,
		contentTestId: "workspace-agent-model-options",
		emptyState: /* @__PURE__ */ f(s.Item, {
			value: "empty",
			asChild: !0,
			children: /* @__PURE__ */ f(l, {
				asChild: !0,
				variant: "compact",
				id: "empty",
				label: A.modelNoneAvailable,
				icon: /* @__PURE__ */ f(o, {
					as: t,
					boxSize: "16px"
				}),
				disabled: !0
			})
		}),
		parentList: {
			items: I,
			selectedLabel: M,
			selectedIcon: n,
			ariaLabel: A.agentSelect,
			disabled: P,
			showSearch: !1,
			contentTestId: "workspace-agent-options",
			emptyState: R,
			onSelect: (e) => {
				a.find((t) => t.value === e.id)?.disabled || d(e.id);
			}
		}
	}) : S ? null : /* @__PURE__ */ f(u, {
		trigger: /* @__PURE__ */ f(i, { children: /* @__PURE__ */ f(_, {
			label: M,
			ariaLabel: A.agentSelect,
			tooltip: A.agentSelect,
			disabled: P,
			size: O
		}) }),
		items: I.map((e) => ({
			...e,
			onSelect: e.isDisabled ? void 0 : () => d(e.id)
		})),
		showSearch: !1,
		width: "260px",
		portalled: D,
		searchPlaceholder: A.modelSearchPlaceholder,
		contentTestId: "workspace-agent-options",
		emptyState: R
	});
};
export { v as t };
