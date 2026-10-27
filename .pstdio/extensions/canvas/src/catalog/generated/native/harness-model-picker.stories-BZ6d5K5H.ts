// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./param-editor-row-59gj0MFP.ts";
import { useState as t } from "react";
import { jsx as n } from "react/jsx-runtime";
// packages/ui/src/components/param-editor/harness-model-picker.tsx
var r = (t) => {
	let { label: r, description: i, harnesses: a, models: o, harnessId: s, model: c = "", disabled: l, loadingHarnesses: u, loadingModels: d, onHarnessChange: f, onModelChange: p } = t, m = o.map((e) => ({
		...e,
		icon: "Cpu"
	}));
	d && m.length === 0 && m.push({
		id: "model-loading",
		name: "Loading models…",
		icon: "Cpu",
		disabled: !0
	});
	let h = {
		id: "model",
		name: r,
		description: i,
		type: "selection",
		defaultValue: c,
		options: m,
		placeholder: "Select model",
		searchable: o.length > 5,
		searchPlaceholder: "Search models…",
		emptyText: "No models available",
		disabled: l || a.length === 0 && !u,
		group: {
			id: "harnessId",
			name: "Harness",
			defaultValue: s,
			options: a.map((e) => ({
				...e,
				icon: "Terminal"
			})),
			placeholder: u ? "Loading harnesses…" : "Select harness",
			searchable: a.length > 10,
			searchPlaceholder: "Search harnesses…",
			emptyText: "No harnesses available",
			disabled: l || u || a.length <= 1
		}
	};
	return /* @__PURE__ */ n(e, {
		param: h,
		values: {
			model: c,
			harnessId: s
		},
		onChange: (e, t) => {
			typeof t == "string" && (e === "harnessId" && f(t), e === "model" && p(t));
		}
	});
}, i = {
	title: "Components/Param Editor/Harness model picker",
	component: r,
	args: {
		label: "Supervisor model",
		harnessId: "codex",
		model: "small",
		harnesses: [{
			id: "codex",
			name: "Codex"
		}, {
			id: "claude",
			name: "Claude Code"
		}],
		models: [{
			id: "small",
			name: "Small model"
		}, {
			id: "large",
			name: "Large model"
		}],
		onHarnessChange: () => {},
		onModelChange: () => {}
	},
	render: function(e) {
		let [i, a] = t(e.harnessId), [o, s] = t(e.model);
		return /* @__PURE__ */ n(r, {
			...e,
			harnessId: i,
			model: o,
			onHarnessChange: a,
			onModelChange: s
		});
	}
}, a = {}, o = { args: {
	models: [],
	loadingModels: !0
} }, s = { args: { harnesses: [{
	id: "codex",
	name: "Codex"
}, {
	id: "claude",
	name: "Claude Code",
	disabled: !0
}] } };
export { a as Default, o as Loading, s as UnavailableHarness, i as default };
