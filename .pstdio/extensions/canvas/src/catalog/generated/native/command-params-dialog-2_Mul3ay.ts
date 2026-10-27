// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { c as e, i as t, l as n, o as r, s as i, t as a } from "./command-palette-params-BB-3_RFH.ts";
import { n as o, t as s } from "./use-command-options-DPiKB0WN.ts";
import { t as c } from "./command-param-field-DbtnulFL.ts";
import { Fragment as l, useState as u } from "react";
import { Box as d, Button as f, CloseButton as p, Dialog as m, HStack as h, Stack as g, Text as _ } from "@chakra-ui/react";
import { AlertMessage as v, ScrollArea as y, handleDialogAcceptShortcut as b } from "@pstdio/ui";
import { jsx as x, jsxs as S } from "react/jsx-runtime";
// packages/pstdio-workbench/src/react/command-palette/command-params-dialog.tsx
var C = (e, n) => e.type === "boolean" ? n !== void 0 : t(n) ? n.refs.length + n.uploads.length > 0 : (Array.isArray(n) || typeof n == "string") && n.length > 0, w = (e) => {
	let [t, n] = u({
		request: e.request,
		revision: 0
	});
	return t.request !== e.request && n({
		request: e.request,
		revision: t.revision + 1
	}), e.request ? /* @__PURE__ */ x(T, {
		...e,
		request: e.request
	}, t.revision) : null;
}, T = (t) => {
	let { request: w, renderParamField: T, prepareArgs: E, executeOptionCommand: D, onClose: O, onRun: k } = t, [A, j] = u(() => a(w.record.command.params, w.args, w.context, w.record.command.resourceMutation)), [M] = u(() => n(w.record.command.params, w.args, w.context)), [N, P] = u(), [F, I] = u(!1), [L, R] = u({}), z = r(w?.record.command.params), B = () => {
		F || O();
	}, V = (e, t) => {
		j((n) => ({
			...n,
			[e]: t
		}));
	}, H = s(w.record.command.params ?? {}, A, D, V, M), [U, W] = u({}), G = async () => {
		if (!w || F) return;
		let t = H.validate(A);
		for (let [e, n] of Object.entries(L)) n && (t[e] = n);
		if (W(t), !(Object.keys(t).length > 0)) {
			I(!0), P(void 0);
			try {
				let t = e(w.record.command.params, A), n = i(w.args, {
					...M,
					...t
				}, w.record.command.params), r = E ? await E({
					commandId: w.record.command.id,
					args: n,
					context: w.context,
					onArgsChange: (e) => j(a(w.record.command.params, e, w.context, w.record.command.resourceMutation))
				}) : n, o = {
					commandId: w.record.command.id,
					args: r,
					context: w.context,
					label: w.label
				};
				await k(o), O();
			} catch (e) {
				P(e instanceof Error ? e.message : "Command failed.");
			} finally {
				I(!1);
			}
		}
	}, K = Object.keys(H.validate(A)).length === 0 && !Object.values(L).some(Boolean) && z.every((e) => !e.required || C(e, A[e.key]));
	return /* @__PURE__ */ S(m.Root, {
		open: w !== null,
		size: "lg",
		scrollBehavior: "inside",
		onOpenChange: (e) => !e.open && B(),
		children: [/* @__PURE__ */ x(m.Backdrop, {}), /* @__PURE__ */ x(m.Positioner, { children: /* @__PURE__ */ S(m.Content, {
			display: "flex",
			flexDirection: "column",
			maxH: "calc(100% - 48px)",
			onKeyDownCapture: (e) => b(e, () => void G(), K && !F),
			children: [
				/* @__PURE__ */ S(m.Header, { children: [/* @__PURE__ */ S(g, {
					gap: "2xs",
					minW: "0",
					children: [/* @__PURE__ */ x(m.Title, { children: w?.label ?? "Run command" }), w?.record.command.description ? /* @__PURE__ */ x(_, {
						textStyle: "paragraph/XS/regular",
						color: "fg.muted",
						truncate: !0,
						children: w.record.command.description
					}) : null]
				}), /* @__PURE__ */ x(m.CloseTrigger, {
					asChild: !0,
					children: /* @__PURE__ */ x(p, {
						size: "sm",
						disabled: F
					})
				})] }),
				/* @__PURE__ */ x(m.Body, {
					flex: "1",
					minH: "0",
					p: "0",
					children: /* @__PURE__ */ x(y, {
						h: "full",
						contentProps: {
							px: "sm",
							py: "md"
						},
						children: /* @__PURE__ */ x(g, {
							gap: "0",
							children: z.map((e) => {
								let t = H.states[e.key], n = e.options && !Array.isArray(e.options), r = {
									entry: n ? {
										...e,
										options: t?.options ?? []
									} : e,
									value: A[e.key],
									disabled: F || !!(n && t?.status !== "ready"),
									onChange: (t) => V(e.key, t),
									onUpdateValue: (t) => j((n) => ({
										...n,
										[e.key]: t(n[e.key])
									})),
									onValidationChange: (t) => R((n) => n[e.key] === t ? n : {
										...n,
										[e.key]: t
									})
								}, i = T?.({
									...r,
									context: w?.context
								});
								return /* @__PURE__ */ S(l, { children: [
									i ?? /* @__PURE__ */ x(c, { ...r }),
									n ? /* @__PURE__ */ x(o, {
										state: t,
										onRetry: () => H.retry(e.key)
									}) : null,
									U[e.key] ? /* @__PURE__ */ x(_, {
										role: "alert",
										px: "sm",
										textStyle: "paragraph/XS/regular",
										color: "fg.error",
										children: U[e.key]
									}) : null
								] }, e.key);
							})
						})
					})
				}),
				N ? /* @__PURE__ */ x(d, {
					px: "lg",
					pb: "md",
					children: /* @__PURE__ */ x(v, {
						status: "error",
						title: N,
						role: "alert"
					})
				}) : null,
				/* @__PURE__ */ x(m.Footer, { children: /* @__PURE__ */ S(h, {
					gap: "2",
					children: [/* @__PURE__ */ x(f, {
						size: "sm",
						variant: "ghost",
						disabled: F,
						onClick: B,
						children: "Cancel"
					}), /* @__PURE__ */ x(f, {
						size: "sm",
						variant: "primary",
						disabled: !K,
						loading: F,
						onClick: () => void G(),
						children: w?.submitLabel ?? "Run"
					})]
				}) })
			]
		}) })]
	});
};
export { w as t };
