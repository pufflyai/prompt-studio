// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { r as e } from "./resource-registry-CVuZngrt.ts";
import { s as t, w as n } from "./workbench-core-kaLFKJEn.ts";
import { t as r } from "./icon-D3uE7jD-.ts";
import { r as i } from "./command-palette-params-BB-3_RFH.ts";
import { r as a } from "./menu-entries-AXOEaqyX.ts";
import { n as o } from "./command-menu-items-DyBydBHL.ts";
import { t as s } from "./command-params-dialog-2_Mul3ay.ts";
import { HStack as c, Text as l } from "@chakra-ui/react";
import { PaletteShortcut as u } from "@pstdio/ui";
import { jsx as d, jsxs as f } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/renderers/tree/tree-actions.tsx
var p = (t, n) => n?.resource ? e(t.context.snapshot(), n.resource) : t.context.snapshot(), m = (e, t, r, i) => n(r, e.command.when) ? e.handler.isVisible?.(t, i) !== !1 : !1, h = async (e) => {
	let { action: t, args: n, context: r, workbench: i } = e, a = t.commandId ? i.commands.getCommand(t.commandId) : void 0, o = n ?? t.args;
	await (a ? i.commands.executeCommand(a.command.id, o, r) : t.run?.(o));
}, g = async (e) => {
	let { action: n, args: r, context: i, onCommandError: a, workbench: o } = e;
	try {
		await h({
			action: n,
			args: r,
			context: i,
			workbench: o
		});
	} catch (e) {
		throw a ? a(e) : t(o, n.label ?? "Action", e), e;
	}
}, _ = (e, t) => {
	if (t.commandId) return e.commands.getCommand(t.commandId);
}, v = (e, t, r, i) => {
	if (!n(r, t.when)) return !1;
	let a = _(e, t);
	return t.commandId && !a ? !1 : !a || m(a, t.args, r, i);
}, y = (e, t, n) => {
	if (t.disabled) return !1;
	let r = _(e, t);
	return !r || e.commands.isCommandEnabled(r.command.id, t.args, n);
}, b = (e) => {
	let { actions: t = [], context: n, onCommandError: a, onRequestParams: o, workbench: s } = e;
	if (t.length === 0) return [];
	let c = p(s, n), l = new Map(s.keybindings.listCommandKeybindings().map((e) => [e.commandId, e.keybinding])), f = [];
	for (let e of t) {
		if (!v(s, e, c, n)) continue;
		let t = _(s, e), p = e.label ?? t?.command.label;
		if (!p) continue;
		let m = e.icon ?? t?.command.icon, b = !y(s, e, n), x = e.commandId ? l.get(e.commandId) : void 0, S = i(e.params) && o ? () => o({
			request: {
				record: { command: {
					id: e.commandId ?? e.id,
					label: p,
					params: e.params,
					resourceMutation: e.resourceMutation ?? t?.command.resourceMutation
				} },
				label: p,
				submitLabel: e.submitLabel,
				args: e.args,
				context: n
			},
			run: (t) => h({
				action: e,
				args: t,
				context: n,
				workbench: s
			})
		}) : void 0;
		f.push({
			id: e.id,
			label: p,
			commandId: t?.command.id ?? e.commandId,
			icon: m ? /* @__PURE__ */ d(r, { name: m }) : void 0,
			endContent: x ? /* @__PURE__ */ d(u, { binding: x }) : void 0,
			disabled: b,
			onAction: () => {
				b || (S ? S() : g({
					action: e,
					context: n,
					workbench: s,
					onCommandError: a
				}).catch(() => void 0));
			}
		});
	}
	return f;
}, x = (e) => {
	let t = b(e), { regularItems: n, kernelItems: r } = e.menuPath ? o({
		...e,
		menuPath: e.menuPath
	}) : {
		regularItems: [],
		kernelItems: []
	}, i = [...t, ...n];
	return [...i, ...a(r, i.length > 0)];
}, S = (e) => {
	let { actions: t = [], context: n, onCommandError: a, onRequestParams: o, workbench: s } = e;
	if (t.length === 0) return [];
	let m = p(s, n), b = new Map(s.keybindings.listCommandKeybindings().map((e) => [e.commandId, e.keybinding])), x = [];
	for (let e of t) {
		if (!v(s, e, m, n) || !y(s, e, n)) continue;
		let t = _(s, e), p = e.label ?? t?.command.label;
		if (!p) continue;
		let S = e.icon ?? t?.command.icon, C = e.commandId ? b.get(e.commandId) : void 0, w = i(e.params) && o ? () => o({
			request: {
				record: { command: {
					id: e.commandId ?? e.id,
					label: p,
					params: e.params,
					resourceMutation: e.resourceMutation ?? t?.command.resourceMutation
				} },
				label: p,
				submitLabel: e.submitLabel,
				args: e.args,
				context: n
			},
			run: (t) => h({
				action: e,
				args: t,
				context: n,
				workbench: s
			})
		}) : void 0;
		x.push({
			id: e.id,
			label: p,
			icon: S ? /* @__PURE__ */ d(r, { name: S }) : void 0,
			tooltip: C ? /* @__PURE__ */ f(c, {
				gap: "2",
				children: [/* @__PURE__ */ d(l, { children: p }), /* @__PURE__ */ d(u, { binding: C })]
			}) : void 0,
			onAction: () => {
				w ? w() : g({
					action: e,
					context: n,
					workbench: s,
					onCommandError: a
				}).catch(() => void 0);
			}
		});
	}
	return x;
}, C = (e) => {
	let { request: t, renderParamField: n, workbench: r, onClose: i } = e;
	return /* @__PURE__ */ d(s, {
		request: t?.request ?? null,
		renderParamField: n,
		executeOptionCommand: (e, n, i) => r.commands.executeCommand(e, n, {
			...t?.request.context,
			signal: i
		}),
		prepareArgs: (e) => r.commands.getCommand(e.commandId) ? r.commands.prepareCommandArgs(e.commandId, e.args, e.context, e.onArgsChange) : Promise.resolve(e.args),
		onClose: i,
		onRun: async ({ args: e }) => {
			await t?.run(e);
		}
	});
};
export { S as n, x as r, C as t };
