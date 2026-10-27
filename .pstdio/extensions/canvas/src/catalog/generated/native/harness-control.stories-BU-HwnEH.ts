// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./harness-control-CdvEvpxN.ts";
import { useState as t } from "react";
import { Box as n } from "@chakra-ui/react";
import { jsx as r } from "react/jsx-runtime";
import { ParamEditor as i } from "@pstdio/ui/param-editor";
// packages/pstdio-workbench/src/react/renderers/controls/harness-control.stories.tsx
var a = (e) => {
	let { value: t, disabled: n, onChange: a } = e, o = JSON.parse(String(t));
	return /* @__PURE__ */ r(i, {
		readOnly: n,
		params: [{
			id: "model",
			name: "Model",
			type: "selection",
			defaultValue: o.model,
			options: [{
				id: "research",
				name: "Research model"
			}],
			group: {
				id: "harnessId",
				name: "Harness",
				defaultValue: o.harnessId,
				options: [{
					id: "codex",
					name: "Codex"
				}]
			}
		}, {
			id: "effort",
			name: "Reasoning effort",
			type: "selection",
			defaultValue: o.params.effort,
			options: [{
				id: "medium",
				name: "Medium"
			}, {
				id: "high",
				name: "High"
			}]
		}],
		onChange: (e, t) => a(JSON.stringify(e === "effort" ? {
			...o,
			params: { effort: t }
		} : {
			...o,
			[e]: t
		}))
	});
}, o = {
	title: "pstdio-workbench/Controls/Research agent",
	component: (i) => {
		let { readOnly: o = !1 } = i, s = {
			harnessId: "codex",
			model: "research",
			params: { effort: "high" }
		}, [c, l] = t(s);
		return /* @__PURE__ */ r(n, {
			maxW: "3xl",
			children: /* @__PURE__ */ r(e, {
				param: {
					id: "agent",
					name: "Model",
					type: "harness",
					defaultValue: s
				},
				value: c,
				onChange: l,
				readOnly: o,
				renderParamField: (e) => /* @__PURE__ */ r(a, { ...e })
			})
		});
	}
}, s = {}, c = { args: { readOnly: !0 } };
export { s as Editable, c as ReadOnly, o as default };
