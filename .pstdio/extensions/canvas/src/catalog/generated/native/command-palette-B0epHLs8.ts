// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { W as e, _ as t, c as n } from "./workbench-core-kaLFKJEn.ts";
import { t as r } from "./use-workbench-store-BMaFgEbb.ts";
import { t as i } from "./icon-D3uE7jD-.ts";
import { r as a } from "./command-palette-params-BB-3_RFH.ts";
import { t as o } from "./action-errors-CACpJ-MK.ts";
import { t as s } from "./use-workbench-composition-panels-DWghJGTR.ts";
import { a as c, c as l, d as u, i as d, l as f, n as p, o as m, r as h, s as g, t as _, u as v } from "./resource-search-DheuKFyd.ts";
import { n as y } from "./palette-params-dialog-2JtYNQ7b.ts";
import { n as b, t as x } from "./panel-widget-open-DyabfObf.ts";
import { useEffect as S, useState as C } from "react";
import { Palette as w, PaletteShortcut as T, useThemePreference as E } from "@pstdio/ui";
import { Fragment as D, jsx as O, jsxs as k } from "react/jsx-runtime";
// packages/pstdio-workbench/src/core/registries/navigation/navigation-target-key.ts
var A = (e) => Array.isArray(e) ? e.map(A) : e && typeof e == "object" ? Object.fromEntries(Object.entries(e).sort(([e], [t]) => e.localeCompare(t)).map(([e, t]) => [e, A(t)])) : e, j = (e) => {
	if (e.kind === "command" && e.args && typeof e.args == "object" && !Array.isArray(e.args) && Object.keys(e.args).length === 0) {
		let { args: t, ...n } = e;
		return JSON.stringify(A(n));
	}
	return JSON.stringify(A(e));
}, M = 25, N = 150, P = (e) => {
	let { workbench: t, query: a, open: o, onClose: s } = e, l = r(t.commandPaletteResources.store, (e) => e.refreshToken), [u, d] = C([]);
	return S(() => {
		if (!o) {
			d([]);
			return;
		}
		let e = !1, r = setTimeout(() => {
			t.commandPaletteResources.queryProviders({
				query: a,
				limit: M
			}).then((r) => {
				e || d(r.flatMap((e) => e.results.map((r) => ({
					id: `workbench-command-palette-resource:${r.id}`,
					mode: c,
					label: r.label,
					searchText: `${a} ${r.label} ${(r.keywords ?? []).join(" ")}`.trim(),
					description: r.description,
					group: r.group ?? e.title,
					icon: r.icon ? /* @__PURE__ */ O(i, { name: r.icon }) : void 0,
					onActivate: () => {
						n(t, r.label, () => r.activate(), {
							inlineTarget: "command-palette",
							onSuccess: s
						});
					}
				}))));
			});
		}, N);
		return () => {
			e = !0, clearTimeout(r);
		};
	}, [
		t,
		a,
		o,
		l,
		s
	]), u;
}, F = (t) => {
	let { onClose: n, panelsByRegion: r, workbench: a } = t, o = a.getPrimaryResource();
	return e.flatMap((e) => (r?.[e] ?? a.composition.panelsFor(e)).addable.map((t) => {
		let r = t.contribution, s = x(e), c = `Open ${r.title} in ${s} Panel`;
		return {
			id: `workbench-panel:${e}:${r.id}`,
			mode: d,
			label: c,
			searchText: `${c} ${r.id}`,
			group: "Panels",
			icon: r.icon ? /* @__PURE__ */ O(i, { name: r.icon }) : void 0,
			onActivate: () => {
				n(), b({
					workbench: a,
					widget: r,
					region: e,
					resource: o,
					pinned: t.pinned,
					open: t.open
				});
			}
		};
	}));
}, I = "theme", L = (e) => e === "pstdio-light" ? "Sun" : e === "pstdio-dark" ? "Moon" : "Palette", R = (e) => e.title ?? e.id, z = (e, t) => Math.max(e.findIndex((e) => e.themePreference === t), 0), B = {
	light: "Light",
	dark: "Dark"
}, V = (e, t) => e.mode === t.mode ? R(e).localeCompare(R(t)) : e.mode === "light" ? -1 : 1, H = (e) => {
	let { chosenThemePreference: t, onClose: n, setThemePreference: r, themePreferences: a } = e;
	return [...a].sort(V).map((e) => {
		let a = R(e);
		return {
			id: `theme:${e.id}`,
			themePreference: e.id,
			mode: I,
			label: a,
			searchText: `theme color appearance ${e.mode} ${e.id} ${a}`,
			group: B[e.mode],
			icon: /* @__PURE__ */ O(i, { name: L(e.id) }),
			isSelected: e.id === t,
			onActivate: () => {
				r(e.id), n();
			}
		};
	});
}, U = (e, t) => [
	t,
	e.id,
	e.description,
	e.category
].filter(Boolean).join(" "), W = (e) => new Map(e.keybindings.listKeybindings().map((e) => [j(e.action), e.keybinding])), G = (e) => e ? /* @__PURE__ */ O(T, { binding: e }) : void 0, K = (e) => {
	let t = e.getPrimaryResource();
	return t ? { resource: t } : void 0;
}, q = async (e) => {
	let { args: t, commandId: r, context: i, label: a, workbench: o, onClose: s } = e, c = o.commandPalette.captureClose(s);
	await n(o, a, () => o.commands.executeCommand(r, t, i), {
		inlineTarget: "command-palette",
		onSuccess: c
	});
}, J = (e) => {
	let { action: t, onClose: n, onRequestParams: r, record: o, workbench: s, shortcutByAction: c } = e, l = t?.args;
	if (!s.commands.isCommandVisible(o.command.id, l)) return null;
	let u = t?.label ?? o.command.label, f = t?.icon ?? o.command.icon, p = t?.group ?? o.command.category;
	return {
		id: `workbench-command:${o.command.id}`,
		commandId: o.command.id,
		mode: d,
		label: u,
		searchText: U(o.command, u),
		description: o.command.description,
		group: p,
		icon: f ? /* @__PURE__ */ O(i, { name: f }) : void 0,
		shortcut: G(c.get(j({
			kind: "command",
			commandId: o.command.id,
			args: l
		})) ?? c.get(j({
			kind: "command",
			commandId: t?.sourceCommandId ?? o.command.id,
			args: l
		}))),
		onActivate: () => {
			let e = K(s);
			a(o.command.params) && r ? (n(), r({
				record: o,
				action: t,
				label: u,
				args: l,
				context: e
			})) : q({
				workbench: s,
				commandId: o.command.id,
				args: l,
				context: e,
				label: u,
				onClose: n
			});
		}
	};
}, Y = (e) => e.action?.group ?? e.record.command.category ?? "", X = (e) => e.action?.order ?? 0, Z = (e, t) => {
	let n = Y(e).localeCompare(Y(t));
	return n === 0 ? X(e) - X(t) : n;
}, Q = (e, t) => t ? e.layout.listMenuItems(t).filter((t) => e.context.matches(t.when)).map((t) => {
	let n = e.commands.getCommand(t.commandId);
	return n ? {
		record: n,
		action: t
	} : null;
}).filter((e) => e !== null) : e.commands.listCommands().map((e) => ({
	record: e,
	action: void 0
})), $ = (e) => {
	let { menuPath: t, onClose: n, onRequestParams: r, workbench: i } = e, a = W(i);
	return Q(i, t).sort(Z).map(({ record: e, action: t }) => J({
		workbench: i,
		record: e,
		action: t,
		shortcutByAction: a,
		onClose: n,
		onRequestParams: r
	})).filter((e) => e !== null);
}, ee = (e) => {
	let { workbench: t, open: n, onClose: i } = e, a = r(t.commandPalette.store, (e) => e.resourceSearch);
	return a && n ? /* @__PURE__ */ O(_, {
		workbench: t,
		request: a,
		onClose: i
	}) : /* @__PURE__ */ O(te, { ...e });
}, te = (e) => {
	let { workbench: n, open: i, menuPath: a = t, initialQuery: c = "", renderParamField: d, onClose: _ } = e, { chosenThemePreference: b, themePreferences: x, setThemePreference: T, previewThemePreference: A } = E(), j = r(n.commandPalette.store, (e) => e.view), M = r(n.commandPalette.store, (e) => e.requestId);
	r(n.keybindings.store, (e) => e.keybindings), r(n.commands.store, (e) => e.commands), r(n.layout.menuStore, (e) => e.itemsByPath);
	let [N, I] = C(c), L = P({
		workbench: n,
		query: N,
		open: i,
		onClose: _
	}), R = s(n), B = () => {
		A(null), _();
	}, V = () => {
		A(null), n.commandPalette.open({ view: "main" });
	}, U = $({
		workbench: n,
		menuPath: a,
		onClose: _,
		onRequestParams: (e) => n.commandPalette.requestParams(e)
	}), W = p({
		workbench: n,
		query: c,
		onClose: _
	}), G = H({
		chosenThemePreference: b,
		themePreferences: x,
		setThemePreference: T,
		onClose: _
	}), K = F({
		workbench: n,
		onClose: _,
		panelsByRegion: R
	}), q = [
		...W,
		...L,
		...U,
		...K,
		...G
	], J = z(G, b), Y = u(j), X = m({
		view: j,
		themeInitialActiveIndex: J
	}), Z = f(j), Q = v(j);
	return S(() => {
		i && I(c);
	}, [
		c,
		i,
		M
	]), S(() => {
		i && Y || A(null);
	}, [
		Y,
		i,
		A
	]), /* @__PURE__ */ k(D, { children: [/* @__PURE__ */ O(h, { children: /* @__PURE__ */ O(w, {
		open: i,
		entries: q,
		initialQuery: c,
		initialActiveIndex: X,
		mode: Z,
		modes: Q,
		resetKey: `${M}:${j}:${c}`,
		inputIcon: ({ mode: e }) => g({
			view: j,
			mode: e
		}),
		placeholder: ({ mode: e }) => l({
			view: j,
			mode: e
		}),
		emptyLabel: "No results found.",
		footerStart: /* @__PURE__ */ O(o, {
			workbench: n,
			target: "command-palette"
		}),
		onActiveEntryChange: (e) => {
			if (!i || !Y) return;
			let t = e;
			t?.themePreference && A(t.themePreference === b ? null : t.themePreference);
		},
		onQueryChange: I,
		onClose: B,
		onEscape: (e) => u(j) ? (V(), !0) : e.query.length > 0 ? (e.setQuery(""), e.setActiveIndex(0), !0) : (B(), !0)
	}) }), /* @__PURE__ */ O(y, {
		workbench: n,
		renderParamField: d
	})] });
};
export { ee as t };
