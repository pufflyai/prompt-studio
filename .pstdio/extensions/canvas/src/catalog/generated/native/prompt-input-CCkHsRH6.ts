// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./scroll-area-I7hjn89T.ts";
import { Bt as t, Dt as n, Lt as r, M as i, N as a, Nt as o, Sn as s, W as c, Yn as l, bn as u, cn as d, ft as f, jn as p, jt as m, ln as h, lt as g, n as _, nn as v, p as y, pn as b, qn as x, r as ee, t as S, vt as C, zt as w } from "./rich-text-theme-C7PhYVHR.ts";
import { t as T } from "./LexicalComposerContext.prod-C-LZ0eF8.ts";
import { t as E } from "./list-row-BhxGCvIh.ts";
import { i as te, n as ne, r as re, t as ie } from "./TreeViewPlugin-CkVdbwL2.ts";
import { n as ae, r as oe, t as se } from "./LexicalHistoryPlugin.prod-jaXHN1zU.ts";
import { forwardRef as ce, useEffect as D, useImperativeHandle as O, useLayoutEffect as k, useRef as A, useState as j } from "react";
import { Box as M, Flex as N, Text as P, useSlotRecipe as F } from "@chakra-ui/react";
import { jsx as I, jsxs as L } from "react/jsx-runtime";
import { createPortal as R } from "react-dom";
// packages/ui/src/components/rich-text/prompt-input/commands.ts
var z = p("INSERT_BLOCK");
// packages/ui/src/components/rich-text/prompt-input/plugins/CommentPlugin/nodes/CommentNode/CommentNode.tsx
function B(e) {
	let t = H();
	return e.style !== null && t.setFormat(e.style.textAlign), { node: t };
}
var V = class e extends f {
	static getType() {
		return "comment";
	}
	static clone(t) {
		return new e(t.__key);
	}
	createDOM(e) {
		let t = document.createElement("blockquote");
		return C(t, e.theme.comment), t;
	}
	updateDOM() {
		return !1;
	}
	static importDOM() {
		return { blockquote: () => ({
			conversion: B,
			priority: 0
		}) };
	}
	exportDOM(e) {
		let { element: t } = super.exportDOM(e);
		if (t && l(t)) {
			this.isEmpty() && t.append(document.createElement("br"));
			let e = this.getFormatType();
			t.style.textAlign = e;
			let n = this.getDirection();
			n && (t.dir = n);
		}
		return { element: t };
	}
	static importJSON(e) {
		let t = H();
		return t.setFormat(e.format), t.setIndent(e.indent), t.setDirection(e.direction), t;
	}
	exportJSON() {
		return {
			...super.exportJSON(),
			type: "comment"
		};
	}
	getTextContent() {
		return `{{! ${super.getTextContent().replace(/([{}])/g, "\\$1")} }}`;
	}
	insertNewAfter(e, t) {
		let n = u(), r = this.getDirection();
		return n.setDirection(r), this.insertAfter(n, t), n;
	}
	collapseAtStart() {
		let e = u();
		return this.getChildren().forEach((t) => {
			e.append(t);
		}), this.replace(e), !0;
	}
};
function H() {
	return new V();
}
// packages/ui/src/components/rich-text/prompt-input/plugins/CommentPlugin/hooks/useCommentCommands.ts
var U = (e, t) => {
	let n = s(), r = H();
	t ? (t.getParent()?.replace(r, !0), t.remove(), r.selectEnd()) : m(n) && c(n, H);
};
function W() {
	let [e] = T();
	return D(() => r(e.registerCommand(z, (e) => {
		let { optionId: t, nodeToReplace: n } = e;
		return U(t, n), !1;
	}, 1)), [e]), null;
}
// packages/ui/src/components/rich-text/prompt-input/plugins/CommentPlugin/hooks/useCommentSchema.ts
var G = () => {
	let [e] = T();
	D(() => r(e.registerNodeTransform(V, (t) => {
		let n = t.getChildren().filter((e) => e.getType() === "comment");
		n.length > 0 && e.update(() => {
			n.forEach((e) => {
				e.replace(u(), !0);
			});
		});
	})), [e]);
};
// packages/ui/src/components/rich-text/prompt-input/plugins/CommentPlugin/CommentPlugin.tsx
function le() {
	return G(), W(), null;
}
// packages/ui/src/components/rich-text/prompt-input/plugins/command-query.ts
var ue = (e) => {
	let t = /(?:^|\s)(\/[^\s/]*)$/.exec(e)?.[1];
	return t ? {
		leadOffset: e.length - t.length,
		matchingString: t.slice(1),
		replaceableString: t
	} : null;
}, de = class extends oe {
	command;
	constructor(e) {
		super(e.name), this.command = e;
	}
}, fe = (t) => {
	let { options: n, selectedIndex: r, onSelect: i, onHighlight: a } = t, o = F({ key: "menu" })();
	return D(() => {
		n[r ?? -1]?.ref?.current?.scrollIntoView({ block: "nearest" });
	}, [n, r]), /* @__PURE__ */ I(M, {
		css: o.content,
		position: "absolute",
		bottom: "100%",
		mb: "2xs",
		zIndex: "popover",
		children: /* @__PURE__ */ I(e, {
			maxH: "xs",
			showHorizontalScrollbar: !1,
			children: n.map((e, t) => /* @__PURE__ */ I(E, {
				id: `typeahead-item-${t}`,
				ref: e.setRefElement,
				role: "option",
				"aria-label": e.command.name,
				"aria-disabled": !!e.command.disabledReason,
				tabIndex: -1,
				variant: "full-width",
				label: e.command.name,
				description: e.command.disabledReason ?? e.command.description,
				disabled: !!e.command.disabledReason,
				isSelected: r === t,
				onMouseDown: (e) => e.preventDefault(),
				onPointerMove: () => a(t),
				onActivate: () => i(e, t)
			}, e.key))
		})
	});
}, pe = (e) => {
	let { commands: t } = e, [r] = T(), [i, a] = j(null);
	D(() => {
		let e = r.getRootElement();
		e?.contains(e.ownerDocument.activeElement) && r.update(() => {
			let e = s();
			e && n(e.clone());
		});
	}, [r]);
	let o = t.filter((e) => e.name.startsWith(`/${i ?? ""}`)).map((e) => new de(e));
	return /* @__PURE__ */ I(ae, {
		onQueryChange: a,
		options: o,
		triggerFn: (e) => {
			let n = ue(e);
			return !n || !t.some((e) => e.name.startsWith(`/${n.matchingString}`)) ? null : n;
		},
		onSelectOption: (e, t, n) => {
			e.command.disabledReason || (r.update(() => {
				t?.replace(b(e.command.onSelect ? "" : `${e.command.name} `)).selectEnd(), n();
			}), e.command.onSelect?.());
		},
		menuRenderFn: (e, { options: t, selectedIndex: n, selectOptionAndCleanUp: r, setHighlightedIndex: i }) => (e.current?.setAttribute("aria-label", "Harness commands"), e.current ? R(/* @__PURE__ */ I(fe, {
			options: t,
			selectedIndex: n,
			onHighlight: i,
			onSelect: (e, t) => {
				i(t), r(e);
			}
		}), e.current) : null)
	});
}, me = (e) => {
	let { requested: t, isEditable: n, onComplete: r } = e, [i] = T(), a = y();
	return k(() => {
		if (!t || !n || !a) return;
		let e = i.getRootElement(), o = document.activeElement;
		o instanceof HTMLElement && !e?.contains(o) && (o.isContentEditable || o.matches("input, textarea, select, iframe")) || e?.focus(), r?.();
	}, [
		t,
		n,
		a,
		i,
		r
	]), null;
}, he = (e) => {
	let t = "", n = e.getChildren(), r = n.length;
	for (let e = 0; e < r; e++) {
		let i = n[e];
		t += i.getTextContent(), o(i) && e !== r - 1 && !i.isInline() && (t += "\n");
	}
	return t;
}, ge = (e) => e.type === "paragraph" && !!e.children?.length, K = (e) => {
	if (e.type === "comment") return "";
	let t = typeof e.text == "string" ? e.text : "", n = e.children;
	if (!Array.isArray(n)) return t;
	let r = n.length;
	for (let e = 0; e < r; e += 1) {
		let i = n[e];
		i.type === "comment" ? e !== r - 1 && (t += "\n") : (t += K(i), ge(i) && (t += "\n"));
	}
	return t;
}, q = (e) => {
	try {
		return K(JSON.parse(e).root ?? {});
	} catch {
		return "";
	}
}, _e = { root: {
	direction: "ltr",
	format: "",
	indent: 0,
	type: "root",
	version: 1,
	children: [{
		type: "paragraph",
		version: 1,
		format: "",
		indent: 0,
		textFormat: void 0,
		direction: null,
		children: []
	}]
} };
function J(e = "") {
	return e.trim() ? { root: {
		direction: "ltr",
		format: "",
		indent: 0,
		type: "root",
		version: 1,
		children: e.split(/\r?\n/).map((e) => ({
			type: "paragraph",
			version: 1,
			format: "",
			indent: 0,
			textFormat: void 0,
			direction: null,
			children: e ? [{
				type: "text",
				version: 1,
				text: e,
				format: "",
				detail: 0,
				mode: "normal",
				style: ""
			}] : []
		}))
	} } : JSON.parse(JSON.stringify(_e));
}
// packages/ui/src/components/rich-text/prompt-input/plugins/ImperativeAPIPlugin.tsx
function ve({ editorRef: e }) {
	let [t] = T();
	return O(e, () => ({ setEditorValue: (e) => {
		let n = t.parseEditorState(JSON.stringify(J(e)), () => {
			g().selectEnd();
		});
		t.setEditorState(n), t.focus();
	} }), [t]), null;
}
// packages/ui/src/components/rich-text/prompt-input/plugins/keyboard-shortcuts.ts
var Y = (e) => e.key === "Enter" && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey, ye = (e) => e.key === "ArrowUp" && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey, be = (e) => e.key === "ArrowDown" && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey, xe = (e, t) => {
	t.preventDefault(), t.shiftKey ? e.dispatchCommand(h, !1) : e.dispatchCommand(d, void 0);
};
function Se(e) {
	let { onSubmit: n, onRecallPrevious: r, onRecallNext: i } = e, [a] = T();
	return D(() => a.registerCommand(t, (e) => a.getRootElement()?.hasAttribute("aria-controls") ? e.key === "Enter" && !Y(e) && (xe(a, e), !0) : Y(e) ? (e.preventDefault(), n?.(), !0) : ye(e) && r?.() || be(e) && i?.() ? (e.preventDefault(), !0) : !1, 3), [
		a,
		n,
		r,
		i
	]), null;
}
// packages/ui/src/components/rich-text/prompt-input/plugins/preserve-selection-plugin.tsx
var X = (e) => {
	let t = x(e.key);
	return t?.isAttached() ? e.type === "text" ? v(t) && e.offset <= t.getTextContentSize() : o(t) && e.offset <= t.getChildrenSize() : !1;
}, Z = (e) => {
	let t = [], n = x(e.key);
	for (; n?.getParent();) t.unshift(n.getIndexWithinParent()), n = n.getParent();
	return {
		path: t,
		offset: e.offset,
		type: e.type
	};
}, Q = (e) => {
	let t = g();
	for (let n of e.path) t = o(t) ? t.getChildAtIndex(n) ?? void 0 : void 0;
	return t ? {
		key: t.getKey(),
		offset: e.offset,
		type: e.type
	} : void 0;
}, Ce = (e) => {
	let { isEditable: t, initialSelection: r, onSelectionChange: i } = e, a = A(r), o = A(i);
	o.current = i;
	let [c] = T(), l = A(null), u = A(t);
	return u.current = t, k(() => c.registerUpdateListener(({ editorState: e }) => {
		e.read(() => {
			let e = l.current;
			if (!e || X(e.anchor) && X(e.focus) || (l.current = null), !u.current) return;
			let t = s();
			m(t) && (l.current = t.clone(), o.current?.({
				anchor: Z(t.anchor),
				focus: Z(t.focus)
			}));
		});
	}), [c]), k(() => {
		if (!t) return;
		let e = c.getRootElement();
		if (!e || e.contains(document.activeElement) || !l.current && !a.current) return;
		let r = () => {
			c.update(() => {
				if (!l.current && a.current) {
					let e = Q(a.current.anchor), t = Q(a.current.focus);
					if (e && t) {
						let n = w();
						n.anchor.set(e.key, e.offset, e.type), n.focus.set(t.key, t.offset, t.type), l.current = n;
					}
					a.current = void 0;
				}
				let e = l.current;
				e && X(e.anchor) && X(e.focus) && n(e.clone());
			}, { discrete: !0 });
		};
		return e.addEventListener("focus", r, { once: !0 }), () => e.removeEventListener("focus", r);
	}, [c, t]), null;
}, $ = {
	...S,
	paragraph: "rich-text__p rich-text__p--no-margin"
}, we = [V, ne], Te = ce((e, t) => {
	let { initialSelection: n, onSelectionChange: r, defaultState: o, debug: s = !1, isEditable: c = !0, placeholder: l } = e, { focusRequested: u = !1, onFocusRequestComplete: d } = e, { onChange: f, onError: p = () => {}, onSubmit: m, onRecallPrevious: h, onRecallNext: v, commands: y = [] } = e, b = {
		namespace: "PROMPT_EDITOR",
		nodes: we,
		editorState: o,
		editable: c,
		onError: p,
		theme: $
	}, x = A(q(o));
	return /* @__PURE__ */ I(N, {
		direction: "column",
		justifyContent: "space-between",
		width: "100%",
		position: "relative",
		children: /* @__PURE__ */ L(a, {
			initialConfig: b,
			children: [
				/* @__PURE__ */ I(se, {}),
				/* @__PURE__ */ I(ee, {
					contentEditable: /* @__PURE__ */ I(_, { fullWidth: !0 }),
					placeholder: l ?? /* @__PURE__ */ I(P, {
						textStyle: "label/M/regular",
						color: "fg.subtle",
						pointerEvents: "none",
						position: "absolute",
						top: "0",
						children: "Type your message here."
					}),
					ErrorBoundary: i
				}),
				/* @__PURE__ */ I(te, {
					ignoreSelectionChange: !0,
					ignoreHistoryMergeTagChange: !1,
					onChange: (e) => {
						e.read(() => {
							let t = he(g());
							t !== x.current && (x.current = t, f?.(t, e.toJSON()));
						});
					}
				}),
				/* @__PURE__ */ I(ve, { editorRef: t }),
				/* @__PURE__ */ I(re, { isEditable: c }),
				/* @__PURE__ */ I(Ce, {
					isEditable: c,
					initialSelection: n,
					onSelectionChange: r
				}),
				/* @__PURE__ */ I(me, {
					requested: u,
					isEditable: c,
					onComplete: d
				}),
				/* @__PURE__ */ I(le, {}),
				/* @__PURE__ */ I(Se, {
					onSubmit: m,
					onRecallPrevious: h,
					onRecallNext: v
				}),
				/* @__PURE__ */ I(pe, { commands: y }, y.map((e) => e.name).join("\n")),
				s ? /* @__PURE__ */ I(ie, {}) : ""
			]
		})
	});
});
export { J as n, q as r, Te as t };
