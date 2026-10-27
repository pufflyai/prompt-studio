// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./useTranslation-DvWg4zeU.ts";
import { useEffect as t, useState as n } from "react";
import { Stack as r, Text as i } from "@chakra-ui/react";
import { useThemePreference as a } from "@pstdio/ui";
import { jsx as o, jsxs as s } from "react/jsx-runtime";
import "@pstdio/sdk/extensions";
import { ParamEditorRow as c } from "@pstdio/ui/param-editor";
// packages/pstdio-workbench/src/react/resource-links/related-resource-previews.ts
var l = "workbench.openRelatedResources", u = (u) => {
	let { workbench: d } = u, [f, p] = n(() => d.preferences.getValue(l) !== !1);
	t(() => {
		let e = d.preferences.onDidChangeValue((e) => {
			e === "workbench.openRelatedResources" && p(d.preferences.getValue(e) !== !1);
		});
		return () => e.dispose();
	}, [d]);
	let { t: m } = e("settings"), { chosenThemePreference: h, themePreferences: g, setThemePreference: _ } = a(), v = [...g].sort((e, t) => e.mode === t.mode ? (e.title ?? e.id).localeCompare(t.title ?? t.id) : e.mode === "light" ? -1 : 1), y = {
		id: "theme",
		name: m("appearance.theme"),
		description: m("appearance.themeHelper"),
		type: "selection",
		defaultValue: h,
		options: v.map((e) => ({
			id: e.id,
			name: e.title ?? e.id
		})),
		searchable: v.length > 5
	};
	return /* @__PURE__ */ s(r, {
		gap: "md",
		padding: "lg",
		maxW: "720px",
		children: [/* @__PURE__ */ s(r, {
			gap: "2xs",
			children: [/* @__PURE__ */ o(i, {
				textStyle: "heading/S",
				children: m("appearance.title")
			}), /* @__PURE__ */ o(i, {
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				children: m("appearance.description")
			})]
		}), /* @__PURE__ */ s(r, {
			gap: "0",
			borderWidth: "1px",
			borderColor: "border.subtle",
			borderRadius: "md",
			py: "xs",
			children: [/* @__PURE__ */ o(c, {
				param: y,
				onChange: (e, t) => {
					typeof t == "string" && _(t);
				}
			}), /* @__PURE__ */ o(c, {
				param: {
					id: "open-related-resources",
					name: m("appearance.openRelatedResources"),
					description: m("appearance.openRelatedResourcesHelper"),
					type: "boolean",
					defaultValue: f
				},
				onChange: (e, t) => {
					typeof t == "boolean" && d.preferences.setValue(l, t, { scope: "user" });
				}
			})]
		})]
	});
};
export { l as n, u as t };
