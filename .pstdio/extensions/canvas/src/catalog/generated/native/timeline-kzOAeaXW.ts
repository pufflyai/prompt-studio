// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./chevron-up-BBUAW_oM.ts";
import { t } from "./circle-question-mark-Ck8Da90Q.ts";
import { a as n, i as r, n as i, o as a, r as o, s, t as c } from "./move-BF9Hr353.ts";
import { t as l } from "./file-CwzjPVtd.ts";
import { t as u } from "./file-text-B9-uT4dU.ts";
import { t as d } from "./globe-CC58dLi6.ts";
import { t as f } from "./list-tree-wIq_OI-O.ts";
import { t as p } from "./search-FHo0INnP.ts";
import { t as m } from "./terminal-B2gAfUK-.ts";
import { t as h } from "./trash-2-C03vrbuo.ts";
import { t as g } from "./triangle-alert-DcqN2fDE.ts";
import { t as _ } from "./scroll-area-I7hjn89T.ts";
import { t as v } from "./tooltip-BweQW627.ts";
import { a as y, r as b, t as x } from "./chat-link-anchor-kdoOkLgc.ts";
import { n as S } from "./resource-badge-Cd8iYFfh.ts";
import { t as C } from "./diff-bubble-CWPQbWDR.ts";
import { n as w, t as T } from "./timeline-tool-blocks-BxxIzavI.ts";
import { Suspense as E, lazy as ee, useState as te } from "react";
import { Avatar as D, Box as O, Button as k, Card as A, Image as j, Link as M, Span as N, Stack as P, Text as F, Timeline as I } from "@chakra-ui/react";
import { Fragment as L, jsx as R, jsxs as z } from "react/jsx-runtime";
// packages/ui/src/components/chat-ui/utils/tool-name.ts
var B = (e) => e.replace(/^tool-/i, "").replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[\s-]+/g, "_").toLowerCase(), V = (e) => {
	let t = B(e), n = t.replace(/_/g, "");
	return [.../* @__PURE__ */ new Set([
		e,
		t,
		n
	])];
}, H = {
	shell: m,
	ls: f,
	read_file: u,
	write_file: r,
	delete_file: h,
	patch: a,
	upload_files: o,
	download_file: n,
	move_file: c
}, ne = {
	dot: s,
	danger: g,
	search: p,
	browser: d,
	file: l,
	question: t,
	todo: i,
	terminal: m,
	...H
}, U = "dot", W = (e) => Object.hasOwn(H, e), G = (e) => ne[e], K = (e) => {
	if (!e) return U;
	let t = B(e);
	if (W(t)) return t;
	let n = t.replace(/_/g, "");
	switch (t) {
		case "read": return "file";
		case "bash": return "terminal";
		case "edit": return "write_file";
		case "apply_patch": return "patch";
		case "grep": return "search";
		case "glob": return "file";
		case "todowrite": return "todo";
		case "search": return "search";
		case "browser": return "browser";
		case "question": return "question";
		case "fs":
		case "file": return "file";
		default: return n === "todowrite" || n === "todo" ? "todo" : U;
	}
}, q = ee(() => import("./diff-editor-CLA3b8qv.ts").then((e) => e.n).then((e) => ({ default: e.DiffEditor }))), J = (e) => /* @__PURE__ */ R(E, {
	fallback: null,
	children: /* @__PURE__ */ R(q, { ...e })
});
// packages/ui/src/components/chat-ui/components/timeline-indicator.tsx
function Y(e) {
	let { ind: t } = e;
	if (!t || t.type === "none") return null;
	if (t.type === "icon") {
		let e = G(t.icon);
		return /* @__PURE__ */ R(I.Indicator, {
			outline: "none",
			border: "none",
			background: "bg",
			color: "fg",
			children: /* @__PURE__ */ R(N, {
				display: "inline-flex",
				alignItems: "center",
				children: /* @__PURE__ */ R(e, {
					size: 14,
					strokeWidth: 1
				})
			})
		});
	}
	return /* @__PURE__ */ R(I.Indicator, { children: /* @__PURE__ */ z(D.Root, {
		boxSize: "full",
		children: [/* @__PURE__ */ R(D.Image, {
			src: t.src,
			alt: t.alt
		}), /* @__PURE__ */ R(D.Fallback, {
			background: "bg.muted",
			color: "fg.muted"
		})]
	}) });
}
// packages/ui/src/components/chat-ui/components/timeline-title.tsx
var X = (e, t, n, r = !1) => {
	r && e.stopPropagation(), t.href || e.preventDefault(), t.filePath && n?.(t.filePath);
};
function Z({ seg: e }) {
	return /* @__PURE__ */ z(D.Root, {
		width: "1.5rem",
		height: "1.5rem",
		children: [/* @__PURE__ */ R(D.Image, {
			src: e.src,
			alt: e.alt
		}), /* @__PURE__ */ R(D.Fallback, {
			background: "bg.muted",
			color: "fg.muted"
		})]
	});
}
function re({ seg: e, onOpenFile: t }) {
	return /* @__PURE__ */ R(C, {
		fileName: e.fileName,
		additions: e.additions ?? 0,
		deletions: e.deletions ?? 0,
		onClickFileLink: () => {
			let n = e.filePath ?? e.fileName;
			t?.(n);
		}
	});
}
function ie({ seg: e, onOpenFile: t }) {
	let n = e.bold ? "medium" : void 0, r = !!(e.href || e.filePath);
	return /* @__PURE__ */ R(M, {
		href: e.href ?? "#",
		fontWeight: n,
		color: (e.muted, "fg.muted"),
		textDecoration: "none",
		cursor: r ? "pointer" : "default",
		onClick: (n) => X(n, e, t, !0),
		_hover: {
			textDecoration: "underline",
			color: e.muted ? "fg.muted" : "fg.blue-dark"
		},
		children: e.text
	});
}
function ae({ seg: e, onOpenFile: t }) {
	let n = e.bold ? "medium" : void 0;
	return /* @__PURE__ */ R(M, {
		href: e.href ?? "#",
		fontWeight: n,
		color: e.muted ? "fg.muted" : "accent.primary",
		textDecoration: "underline",
		onClick: (n) => X(n, e, t),
		_hover: {
			color: e.muted ? "fg.muted" : "accent.primary",
			textDecoration: "underline"
		},
		children: e.text
	});
}
function oe({ seg: e, isClickable: t }) {
	let n = /* @__PURE__ */ R(N, {
		fontWeight: e.bold ? "medium" : void 0,
		textStyle: e.monospace ? "mono/XS" : void 0,
		color: "fg.muted",
		minW: e.truncate ? "0" : void 0,
		overflow: e.truncate ? "hidden" : void 0,
		textOverflow: e.truncate ? "ellipsis" : void 0,
		whiteSpace: e.truncate ? "nowrap" : void 0,
		_groupHover: { color: t && !e.muted ? "fg" : "fg.muted" },
		children: e.text
	});
	return e.truncate ? /* @__PURE__ */ R(v, {
		content: e.text,
		children: n
	}) : n;
}
function se({ seg: e, isClickable: t, onOpenFile: n }) {
	if (y() && (e.kind === "link" || e.kind === "diff") && (e.filePath || e.kind === "diff")) {
		let t = e.filePath ?? (e.kind === "diff" ? e.fileName : e.text);
		return /* @__PURE__ */ R(x, {
			candidate: {
				source: t,
				origin: "tool"
			},
			children: e.kind === "diff" ? /* @__PURE__ */ R(C, {
				fileName: e.fileName,
				additions: e.additions ?? 0,
				deletions: e.deletions ?? 0
			}) : e.text
		});
	}
	switch (e.kind) {
		case "avatar": return /* @__PURE__ */ R(Z, { seg: e });
		case "diff": return /* @__PURE__ */ R(re, {
			seg: e,
			onOpenFile: n
		});
		case "link": return e.variant === "bubble" ? /* @__PURE__ */ R(ie, {
			seg: e,
			onOpenFile: n
		}) : /* @__PURE__ */ R(ae, {
			seg: e,
			onOpenFile: n
		});
		case "text": return /* @__PURE__ */ R(oe, {
			seg: e,
			isClickable: t
		});
		default: return null;
	}
}
// packages/ui/src/components/chat-ui/components/timeline.tsx
var Q = I;
function ce({ code: e, language: t }) {
	return /* @__PURE__ */ R(_, {
		background: "bg.code",
		color: "fg.muted",
		borderWidth: "1px",
		borderColor: "border.subtle",
		borderRadius: "md",
		showHorizontalScrollbar: !0,
		showVerticalScrollbar: !1,
		children: /* @__PURE__ */ R(O, {
			as: "pre",
			padding: "sm",
			textStyle: "mono/XS",
			whiteSpace: "pre",
			"aria-label": t ? `${t} code block` : "code block",
			children: /* @__PURE__ */ R(O, {
				as: "code",
				children: e
			})
		})
	});
}
function le({ b: e, onOpenFile: t }) {
	switch (e.type) {
		case "comment": return /* @__PURE__ */ z(A.Root, { children: [/* @__PURE__ */ R(A.Body, { children: e.text }), e.reactions?.clap ? /* @__PURE__ */ R(A.Footer, { children: /* @__PURE__ */ z(k, { children: ["👏 ", e.reactions.clap] }) }) : null] });
		case "code": return /* @__PURE__ */ R(A.Root, {
			border: "0",
			padding: "0",
			children: /* @__PURE__ */ R(A.Body, {
				padding: "0",
				children: /* @__PURE__ */ R(ce, {
					language: e.language,
					code: e.code
				})
			})
		});
		case "diff": return /* @__PURE__ */ R(A.Root, {
			border: "0",
			padding: "0",
			children: /* @__PURE__ */ R(A.Body, {
				padding: "0",
				children: /* @__PURE__ */ R(O, {
					height: "240px",
					minW: "320px",
					overflow: "hidden",
					children: /* @__PURE__ */ R(J, {
						original: e.original,
						modified: e.modified,
						language: e.language,
						sideBySide: e.sideBySide ?? !1,
						disableScroll: !0
					})
				})
			})
		});
		case "text": return /* @__PURE__ */ R(A.Root, {
			background: "transparent",
			children: /* @__PURE__ */ R(A.Body, {
				padding: "sm",
				children: /* @__PURE__ */ R(F, {
					textStyle: "label/S/regular",
					children: e.text
				})
			})
		});
		case "todo-list": return /* @__PURE__ */ R(w, { items: e.items });
		case "question-form": return /* @__PURE__ */ R(T, { questions: e.questions });
		case "references": return /* @__PURE__ */ R(P, {
			mt: "xs",
			gap: "xs",
			flexDir: "row",
			flexWrap: "wrap",
			children: e.references.map((e) => /* @__PURE__ */ R(x, {
				candidate: {
					source: e,
					origin: "tool"
				},
				children: /* @__PURE__ */ R(S, { fileName: e })
			}, e))
		});
		case "image": return e.src.trim() ? /* @__PURE__ */ R(A.Root, {
			border: "0",
			padding: "0",
			background: "transparent",
			children: /* @__PURE__ */ z(A.Body, {
				padding: "0",
				children: [/* @__PURE__ */ R(j, {
					src: e.src,
					alt: e.alt,
					maxH: "18rem",
					maxW: "full",
					objectFit: "contain",
					borderRadius: "sm",
					borderWidth: "1px",
					borderColor: "border.subtle"
				}), e.caption ? /* @__PURE__ */ R(F, {
					mt: "2xs",
					textStyle: "label/XS/regular",
					color: "fg.muted",
					children: e.caption
				}) : null]
			})
		}) : null;
		case "component": return /* @__PURE__ */ R(L, { children: e.render({ onOpenFile: t }) });
	}
}
function $({ item: t, itemKey: n, isOpen: r, canExpand: i, hasBlocks: a, onToggle: o, onOpenFile: s }) {
	return /* @__PURE__ */ z(Q.Item, {
		gap: "xs",
		children: [/* @__PURE__ */ z(Q.Connector, { children: [/* @__PURE__ */ R(Q.Separator, {}), /* @__PURE__ */ R(Y, { ind: t.indicator })] }), /* @__PURE__ */ z(Q.Content, {
			h: r ? "auto" : "20px",
			children: [t.title.length > 0 && /* @__PURE__ */ R(Q.Title, {
				className: "group",
				fontWeight: "normal",
				display: "flex",
				alignItems: "center",
				minW: "0",
				width: "full",
				overflow: "hidden",
				cursor: i ? "pointer" : "default",
				onClick: i ? () => o(n) : void 0,
				children: /* @__PURE__ */ z(N, {
					display: "flex",
					alignItems: "center",
					gap: "sm",
					flexWrap: "nowrap",
					minW: "0",
					width: "full",
					children: [/* @__PURE__ */ R(N, {
						display: "flex",
						alignItems: "center",
						gap: "xs",
						flexWrap: "nowrap",
						minW: "0",
						flex: "1",
						overflow: "hidden",
						children: t.title.map((e, t) => /* @__PURE__ */ R(se, {
							seg: e,
							isClickable: i,
							onOpenFile: s
						}, t))
					}), i ? /* @__PURE__ */ R(N, {
						display: "inline-flex",
						alignItems: "center",
						transition: "transform 200ms ease, color 200ms ease",
						transform: r ? "rotate(0deg)" : "rotate(-180deg)",
						color: "transparent",
						flexShrink: "0",
						_groupHover: { color: "fg" },
						children: /* @__PURE__ */ R(e, { size: 12 })
					}) : null]
				})
			}), a ? /* @__PURE__ */ R(O, {
				display: "grid",
				gridTemplateRows: r ? "1fr" : "0fr",
				transition: "grid-template-rows 220ms ease",
				children: r ? /* @__PURE__ */ R(O, {
					overflow: "hidden",
					opacity: 1,
					transform: "translateY(0)",
					transition: "opacity 200ms ease, transform 200ms ease",
					children: t.blocks.map((e, t) => /* @__PURE__ */ R(O, { children: /* @__PURE__ */ R(le, {
						b: e,
						onOpenFile: s
					}) }, t))
				}) : null
			}) : null]
		})]
	}, n);
}
function ue(e) {
	let t = y();
	return /* @__PURE__ */ R(b, {
		handler: e.linkHandler ?? t,
		children: /* @__PURE__ */ R(de, { ...e })
	});
}
function de(e) {
	let { data: t } = e, n = y(), r = n ? (e) => {
		n.open({
			source: e,
			origin: "tool"
		});
	} : void 0, [i, a] = te({}), o = (e, t) => e.id ? `id:${e.id}` : `idx:${t}`, s = (e) => {
		a((t) => ({
			...t,
			[e]: !t[e]
		}));
	};
	return /* @__PURE__ */ R(Q.Root, {
		variant: "tool",
		children: t.items.map((e, t) => {
			let n = o(e, t), a = (e.blocks?.length ?? 0) > 0, c = (e.expandable ?? !0) && a, l = c ? i[n] ?? !1 : a;
			return /* @__PURE__ */ R($, {
				item: e,
				itemKey: n,
				isOpen: l,
				canExpand: c,
				hasBlocks: a,
				onToggle: s,
				onOpenFile: r
			}, n);
		})
	});
}
export { B as i, K as n, V as r, ue as t };
