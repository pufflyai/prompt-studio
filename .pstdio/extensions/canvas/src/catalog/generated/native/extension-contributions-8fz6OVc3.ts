// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./bot-DyijWSfK.ts";
import { t } from "./check-Bgh538vW.ts";
import { t as n } from "./command-Dtx3XZCF.ts";
import { t as r } from "./copy-COTDVt4R.ts";
import { t as i } from "./file-code-Bdj5XAS8.ts";
import { t as a } from "./layout-dashboard-Bec5X_C-.ts";
import { t as o } from "./list-tree-wIq_OI-O.ts";
import { t as s } from "./menu-BWYEQEaZ.ts";
import { t as c } from "./palette-pgRzNhdq.ts";
import { t as l } from "./panels-top-left-C2mYVVSC.ts";
import { t as u } from "./sliders-horizontal-0NDBIxRS.ts";
import { t as d } from "./sparkles-GpXFEeOw.ts";
import { t as f } from "./terminal-B2gAfUK-.ts";
import { t as p } from "./timer-B6AbcL3H.ts";
import { t as m } from "./useTranslation-DvWg4zeU.ts";
import { t as h } from "./extension-localization-BwKrr4Fv.ts";
import { useState as g } from "react";
import { Code as _, HStack as v, Icon as y, IconButton as b, Kbd as x, Stack as S, Text as C } from "@chakra-ui/react";
import { Fragment as w, jsx as T, jsxs as E } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/settings/components/extension-contributions.tsx
var D = (e, t) => e === void 0 ? "" : h(e, t), O = (e, t) => (e ?? []).filter((e) => e.extensionId === t), k = (e, t, n) => ({
	id: e,
	title: t || e,
	meta: n || void 0
}), A = (t, r) => {
	let p = new Map(O(t?.keybindings, r).flatMap((e) => typeof e.key == "string" ? [[String(e.commandId), e.key]] : []));
	return [
		{
			key: "harnesses",
			icon: e,
			rows: O(t?.harnesses, r).map((e) => k(String(e.id), D(e.label, r) || String(e.localId)))
		},
		{
			key: "commands",
			icon: f,
			rows: O(t?.commands, r).map((e) => ({
				...k(String(e.id), D(e.title, r)),
				cli: typeof e.cliPath == "string" ? `pst ${e.cliPath}` : void 0,
				keys: p.get(String(e.id))
			}))
		},
		{
			key: "modes",
			icon: a,
			rows: O(t?.modes, r).map((e) => k(String(e.id), D(e.label, r)))
		},
		{
			key: "views",
			icon: l,
			rows: O(t?.views, r).map((e) => k(String(e.id), D(e.title, r), typeof e.path == "string" ? e.path : void 0))
		},
		{
			key: "placements",
			icon: a,
			rows: O(t?.placements, r).map((e) => k(String(e.id), String(e.region)))
		},
		{
			key: "menuContributions",
			icon: s,
			rows: O(t?.menuContributions, r).map((e) => k(String(e.commandId ?? e.id), D(e.label, r), typeof e.slotId == "string" ? e.slotId : void 0))
		},
		{
			key: "settingsPanels",
			icon: u,
			rows: O(t?.settingsPanels, r).map((e) => k(String(e.id), String(e.view.id ?? e.id)))
		},
		{
			key: "skills",
			icon: d,
			rows: O(t?.skills, r).map((e) => k(String(e.id), D(e.title, r) || String(e.localId)))
		},
		{
			key: "templates",
			icon: i,
			rows: O(t?.templates, r).map((e) => k(String(e.id), D(e.title, r) || String(e.localId)))
		},
		{
			key: "themes",
			icon: c,
			rows: O(t?.themes, r).map((e) => k(String(e.id), D(e.title, r) || String(e.localId)))
		},
		{
			key: "navigationItems",
			icon: o,
			rows: O(t?.navigationItems, r).map((e) => k(String(e.id), D(e.label, r)))
		},
		{
			key: "navigationTrees",
			icon: o,
			rows: O(t?.navigationTrees, r).map((e) => k(String(e.id), String(e.id)))
		},
		{
			key: "commandPaletteResources",
			icon: n,
			rows: O(t?.commandPaletteResources, r).map((e) => k(String(e.id), D(e.label ?? e.title, r)))
		}
	].filter((e) => e.rows.length > 0);
}, j = (e) => {
	let { icon: t, label: n, count: r } = e;
	return /* @__PURE__ */ E(v, {
		gap: "2xs",
		paddingTop: "md",
		paddingBottom: "2xs",
		children: [
			/* @__PURE__ */ T(y, {
				boxSize: "3.5",
				color: "fg.subtle",
				children: /* @__PURE__ */ T(t, {})
			}),
			/* @__PURE__ */ T(C, {
				textStyle: "label/XS/medium",
				color: "fg.subtle",
				textTransform: "uppercase",
				letterSpacing: "0.06em",
				children: n
			}),
			/* @__PURE__ */ T(C, {
				textStyle: "label/XS",
				color: "fg.subtle",
				children: r
			})
		]
	});
}, M = (e) => {
	let { command: n } = e, { t: i } = m("projects"), [a, o] = g(!1);
	return /* @__PURE__ */ T(b, {
		variant: "ghost",
		size: "2xs",
		"aria-label": i("projectSettings.extensionsPanel.detail.copyCommand"),
		onClick: async () => {
			await navigator.clipboard.writeText(n), o(!0), setTimeout(() => o(!1), 1500);
		},
		"data-testid": "extension-cli-copy",
		children: T(a ? t : r, { size: 12 })
	});
}, N = (e) => e.split("+").map((e) => e.trim()), P = (e) => {
	let { record: t, endContent: n } = e;
	return /* @__PURE__ */ E(v, {
		gap: "md",
		minH: "7",
		"data-testid": "extension-contribution-row",
		children: [
			/* @__PURE__ */ T(C, {
				textStyle: "label/S/regular",
				w: "240px",
				flexShrink: "0",
				truncate: !0,
				children: t.title
			}),
			/* @__PURE__ */ T(C, {
				textStyle: "label/XS",
				fontFamily: "mono",
				color: "fg.muted",
				w: "280px",
				flexShrink: "0",
				truncate: !0,
				children: t.id
			}),
			/* @__PURE__ */ E(v, {
				gap: "2xs",
				flex: "1",
				minW: "0",
				children: [t.cli && /* @__PURE__ */ E(w, { children: [/* @__PURE__ */ T(_, {
					textStyle: "label/XS",
					children: t.cli
				}), /* @__PURE__ */ T(M, { command: t.cli })] }), !t.cli && /* @__PURE__ */ T(C, {
					textStyle: "label/XS",
					color: "fg.subtle",
					truncate: !0,
					children: t.meta ?? ""
				})]
			}),
			t.keys && /* @__PURE__ */ T(v, {
				gap: "shortcut-key-gap",
				flexShrink: "0",
				children: N(t.keys).map((e) => /* @__PURE__ */ T(x, {
					size: "sm",
					children: e
				}, e))
			}),
			n
		]
	});
}, F = (e) => {
	let { metadata: t, extensionId: n, automations: r } = e, { t: i } = m("projects"), a = A(t, n);
	return /* @__PURE__ */ E(S, {
		gap: "0",
		children: [
			r.length > 0 && /* @__PURE__ */ E(S, {
				gap: "0",
				children: [/* @__PURE__ */ T(j, {
					icon: p,
					label: i("projectSettings.extensionsPanel.automations.title"),
					count: r.length
				}), r.map((e) => /* @__PURE__ */ T(P, { record: {
					id: e.commandId,
					title: h(e.title, e.extensionId),
					meta: i("projectSettings.extensionsPanel.automations.cron", { cron: e.cron })
				} }, e.id))]
			}),
			a.map((e) => /* @__PURE__ */ E(S, {
				gap: "0",
				children: [/* @__PURE__ */ T(j, {
					icon: e.icon,
					label: i(`projectSettings.extensionsPanel.detail.contributionKinds.${e.key}`),
					count: e.rows.length
				}), e.rows.map((e, t) => /* @__PURE__ */ T(P, { record: e }, `${e.id}-${t}`))]
			}, e.key)),
			a.length === 0 && r.length === 0 && /* @__PURE__ */ T(C, {
				textStyle: "label/XS",
				color: "fg.muted",
				paddingTop: "xs",
				children: i("projectSettings.extensionsPanel.detail.noContributions")
			})
		]
	});
};
export { F as t };
