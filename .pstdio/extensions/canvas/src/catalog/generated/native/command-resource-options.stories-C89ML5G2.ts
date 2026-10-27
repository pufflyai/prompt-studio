// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./command-params-dialog-2_Mul3ay.ts";
import { t } from "./workbench-theme-provider-CQSyY8qK.ts";
import { useState as n } from "react";
import { Button as r, Stack as i } from "@chakra-ui/react";
import { jsx as a, jsxs as o } from "react/jsx-runtime";
var s = {
	title: "pstdio-workbench/Guides/Command resource options",
	component: () => {
		let [s, c] = n();
		return /* @__PURE__ */ a(t, { children: /* @__PURE__ */ o(i, {
			align: "start",
			children: [["first", "second"].map((e) => /* @__PURE__ */ o(r, {
				size: "sm",
				onClick: () => c(e),
				children: [
					"Open ",
					e,
					" instance"
				]
			}, e)), /* @__PURE__ */ a(e, {
				request: s ? {
					label: "Choose template",
					context: { resource: {
						type: "instance",
						id: s,
						metadata: { instance: s }
					} },
					record: { command: {
						id: "run",
						label: "Choose template",
						params: {
							instance: {
								type: "text",
								resolvedFrom: "resource",
								required: !0
							},
							template: {
								type: "select",
								required: !0,
								options: {
									commandId: "templates",
									valueField: "id",
									labelField: "name",
									params: { instance: {
										kind: "param-value",
										key: "instance"
									} }
								}
							}
						}
					} }
				} : null,
				executeOptionCommand: async (e, t) => [{
					id: `${t.instance}-template`,
					name: `Template for ${t.instance}`
				}],
				onClose: () => c(void 0),
				onRun: async () => c(void 0)
			})]
		}) });
	}
}, c = {};
export { c as HiddenResourceDependency, s as default };
