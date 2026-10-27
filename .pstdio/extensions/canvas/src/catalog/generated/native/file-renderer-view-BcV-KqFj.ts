// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./workbench-core-N58OeDyx.ts";
import { t } from "./renderer-read-key-WONjLXkB.ts";
import { n } from "./use-page-params-BMVjuYZ6.ts";
import { t as r } from "./file-renderer-error-notice-BnIDNvg0.ts";
import { Suspense as i, lazy as a, useEffect as o, useLayoutEffect as s, useRef as c, useState as l } from "react";
import { Box as u, Button as d, Center as f, Flex as p, Image as m, Spinner as h, Text as g } from "@chakra-ui/react";
import { AlertMessage as _, EmptyState as v, Header as y, resolveFileIconElement as b, useFileIconThemePreference as x } from "@pstdio/ui";
import { jsx as S, jsxs as C } from "react/jsx-runtime";
import { resourceKey as w } from "@pstdio/sdk/extensions";
import { LazyMarkdownEditor as T } from "@pstdio/ui/rich-text";
// packages/pstdio-workbench/src/extensions/contributions/file-storage-versions.ts
var E = Symbol("file storage versions"), D = (e) => e?.[E] ?? {}, O = (e, t) => {
	let n = t?.outcome?.data?.fileStorageVersions;
	return n && typeof n == "object" && !Array.isArray(n) && Object.assign(e, { [E]: n }), e;
}, k = (e, t) => Object.assign(e, { [E]: D(t) }), A = 30, j = /* @__PURE__ */ new Map(), ee = (e) => j.get(e), M = (e) => {
	for (let t of j.keys()) t.startsWith(`${JSON.stringify(e)}:`) && j.delete(t);
}, N = (e, t) => {
	if (j.delete(e), j.set(e, t), j.size <= A) return;
	let n = j.keys().next().value;
	n !== void 0 && j.delete(n);
}, P = (e, t, n, r) => !e || e.loadKey !== n ? 1 : (r ?? e.content) === t.content && e.dataUrl === t.dataUrl ? e.editorRevision : e.editorRevision + 1, te = (e, t, n) => {
	let r = n ? n.acceptLoaded(e.content, e.revision) : { shown: void 0 };
	if (r) return N(t, e), (n) => ({
		...e,
		editorRevision: P(n, e, t, r.shown),
		loadKey: t
	});
}, F = async (e, t, n, r, i) => {
	let a = await e.save?.(t, n, r, i), o = i ? k({
		...i,
		content: n
	}, a) : void 0;
	return {
		result: a ?? void 0,
		content: o
	};
}, I = "pstdio.fileSectionNavigation", L = (e) => {
	if (!e || typeof e != "object") return !1;
	let t = e, n = t.occurrence === void 0 || typeof t.occurrence == "number" && Number.isInteger(t.occurrence) && t.occurrence >= 0;
	return typeof t.id == "string" && typeof t.heading == "string" && n;
}, ne = (e) => {
	let t = e?.metadata?.[I];
	if (!t || typeof t != "object") return;
	let n = t;
	if (typeof n.treeId == "string" && typeof n.targetNodeId == "string" && Array.isArray(n.anchors) && n.anchors.every(L)) return {
		treeId: n.treeId,
		targetNodeId: n.targetNodeId,
		anchors: n.anchors
	};
}, R = (e, t) => t && e.anchors.some((e) => e.id === t) ? t : e.targetNodeId, z = (e) => {
	let { previous: t, current: n, currentResourceKey: r, selectedNodeId: i } = e;
	return !t || !i || !t.anchorIds.includes(i) || n?.targetNodeId === i ? !1 : !n || t.treeId !== n.treeId || t.resourceKey !== r;
}, B = () => /* @__PURE__ */ S(f, {
	h: "full",
	minH: "0",
	bg: "bg",
	children: /* @__PURE__ */ S(h, { size: "sm" })
}), V = /* @__PURE__ */ new Set([
	"png",
	"jpg",
	"jpeg",
	"gif",
	"webp",
	"svg",
	"avif",
	"bmp",
	"ico"
]), H = /* @__PURE__ */ new Set([
	"md",
	"markdown",
	"txt"
]), U = {
	ts: "typescript",
	tsx: "typescript",
	js: "javascript",
	jsx: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	json: "json",
	jsonc: "json",
	py: "python",
	rb: "ruby",
	rs: "rust",
	go: "go",
	java: "java",
	kt: "kotlin",
	c: "c",
	h: "c",
	cpp: "cpp",
	cc: "cpp",
	hpp: "cpp",
	cs: "csharp",
	php: "php",
	swift: "swift",
	sh: "shell",
	bash: "shell",
	zsh: "shell",
	sql: "sql",
	css: "css",
	scss: "scss",
	less: "less",
	html: "html",
	xml: "xml",
	yml: "yaml",
	yaml: "yaml",
	toml: "ini",
	ini: "ini",
	dockerfile: "dockerfile",
	graphql: "graphql",
	gql: "graphql",
	md: "markdown",
	markdown: "markdown",
	txt: "plaintext"
}, W = (e) => {
	if (!e) return "";
	let t = e.lastIndexOf(".");
	return t < 0 || t === e.length - 1 ? "" : e.slice(t + 1).toLowerCase();
}, G = (e, t) => t?.startsWith("image/") ? !0 : V.has(W(e)), K = (e, t) => {
	if (G(e, t)) return "image";
	let n = W(e);
	return !H.has(n) && n in U ? "code" : "markdown";
}, q = (e) => U[W(e)] ?? "plaintext", J = (e, t) => {
	if (e.emptyState) return {
		kind: "empty",
		isEditable: !1
	};
	let n = K(e.fileName, e.mimeType);
	if (n === "image") return {
		kind: "image",
		isEditable: !1
	};
	let r = t && e.editable !== !1;
	return n === "code" || e.textRenderer === "monaco" ? {
		kind: "code",
		isEditable: r,
		language: q(e.fileName)
	} : {
		kind: "markdown",
		isEditable: r
	};
}, Y = a(() => import("@pstdio/ui/diff").then((e) => ({ default: e.CodeEditor }))), X = (e) => {
	let { content: t, position: n, editorKey: r, errorNotice: a, contributionCanSave: o, onActiveSectionChange: c, onChange: l, rendererRef: d, sectionNavigation: h, title: y } = e;
	if (s(() => {
		if (!r || h) return;
		let e = d.current;
		if (!e) return;
		let t = requestAnimationFrame(() => {
			let t = e.parentElement;
			for (; t;) {
				let e = getComputedStyle(t).overflowY;
				[
					"auto",
					"scroll",
					"overlay"
				].includes(e) && t.scrollHeight > t.clientHeight && (t.scrollTop = 0), t = t.parentElement;
			}
		});
		return () => cancelAnimationFrame(t);
	}, [
		r,
		h,
		d
	]), !t) return /* @__PURE__ */ S(B, {});
	let b = J(t, o), x = n && b.kind !== "code" && b.kind !== "empty" ? /* @__PURE__ */ S(_, {
		status: "info",
		title: "Source location unavailable",
		children: "This preview does not support source line selection."
	}) : null;
	return b.kind === "empty" ? /* @__PURE__ */ C(p, {
		direction: "column",
		h: "full",
		minH: "0",
		bg: "bg",
		children: [
			a,
			x,
			/* @__PURE__ */ S(v, {
				flex: "1",
				minH: "0",
				title: t.emptyState?.title ?? "Select a file",
				description: t.emptyState?.description
			})
		]
	}) : b.kind === "image" ? t.dataUrl ? /* @__PURE__ */ C(p, {
		direction: "column",
		h: "full",
		minH: "0",
		bg: "bg",
		children: [
			a,
			x,
			/* @__PURE__ */ S(f, {
				ref: d,
				flex: "1",
				minH: "0",
				p: "md",
				overflow: "auto",
				children: /* @__PURE__ */ S(m, {
					src: t.dataUrl,
					alt: t.fileName ?? y,
					maxW: "100%",
					maxH: "100%",
					objectFit: "contain"
				})
			})
		]
	}) : /* @__PURE__ */ S(f, {
		h: "full",
		minH: "0",
		bg: "bg",
		p: "md",
		children: /* @__PURE__ */ S(g, {
			color: "fg.muted",
			children: "This image preview is unavailable."
		})
	}) : b.kind === "code" ? /* @__PURE__ */ C(p, {
		direction: "column",
		h: "full",
		minH: "0",
		bg: "bg",
		children: [
			a,
			x,
			/* @__PURE__ */ S(u, {
				flex: "1",
				minH: "0",
				children: /* @__PURE__ */ S(i, {
					fallback: /* @__PURE__ */ S(B, {}),
					children: /* @__PURE__ */ S(Y, {
						language: b.language,
						position: n,
						fileName: t.fileName,
						defaultCode: t.content ?? "",
						isEditable: b.isEditable,
						showLineNumbers: !0,
						onChange: b.isEditable ? l : void 0
					}, r)
				})
			})
		]
	}) : /* @__PURE__ */ C(p, {
		ref: d,
		direction: "column",
		h: "full",
		minH: "0",
		overflow: "hidden",
		bg: "bg",
		children: [
			a,
			x,
			/* @__PURE__ */ S(u, {
				flex: "1",
				minH: "0",
				overflowY: "auto",
				children: /* @__PURE__ */ S(T, {
					defaultState: t.content ?? "",
					isEditable: b.isEditable,
					sectionNavigation: h,
					placeholder: b.isEditable ? t.placeholder ?? "Write…" : void 0,
					onActiveSectionChange: c,
					onChange: b.isEditable ? l : void 0
				}, r)
			})
		]
	});
}, re = (e) => {
	let t, n = !1, r, i = null, a = null, o, s, c = !1, l = null, u = 0, d = /* @__PURE__ */ new Set(), f = /* @__PURE__ */ new Set(), p = (e) => e instanceof Error ? e.message : "Failed to save file.", m = () => ({
		dirty: i !== null || a !== null && a.value !== t,
		saving: a !== null,
		...o ? { saveError: o } : {},
		...n ? { removed: !0 } : {}
	}), h = () => e.onStateChange?.(m()), g = () => {
		l !== null && (clearTimeout(l), l = null);
	}, _ = () => e.createOperationId?.() ?? `file-save-${Date.now()}-${++u}`, v = () => i !== null || a !== null || l !== null || !!o, y = (e) => {
		e.revision && (!s || e.revision.localeCompare(s) > 0) && (s = e.revision), e.revision || (c = !0);
	}, b = (t) => {
		let n = t.origin?.operationId;
		return !n || t.origin?.rendererId !== e.binding.rendererId || t.origin.instanceId !== e.binding.instanceId ? !1 : a?.origin.operationId === n || f.has(n);
	}, x = (t) => {
		if (i !== null || a) return;
		let n = s, r = c;
		s = void 0, c = !1, n && (!t || n.localeCompare(t) > 0) ? e.load({
			resourceKey: e.binding.resourceKey,
			revision: n
		}) : r && e.load({ resourceKey: e.binding.resourceKey });
	}, S = () => {
		if (n || i === null || a || o) return;
		let s = i;
		i = null;
		let c = {
			rendererId: e.binding.rendererId,
			instanceId: e.binding.instanceId,
			operationId: _()
		};
		a = {
			value: s,
			origin: c
		}, h(), Promise.resolve(e.save(s, c)).then((e) => {
			a?.origin.operationId === c.operationId && (a = null, f.add(c.operationId), f.size > 20 && f.delete(f.values().next().value), t = s, r = e?.revision ?? r, i === t && (i = null, g()), h(), i === null ? x(e?.revision) : C());
		}).catch((e) => {
			n || a?.origin.operationId === c.operationId && (a = null, i === null && (i = s), o = p(e), h());
		});
	}, C = () => {
		g(), l = setTimeout(() => {
			l = null, S();
		}, e.debounceMs);
	};
	return {
		getDraft() {
			return i ?? a?.value ?? t;
		},
		markRemoved() {
			let e = v();
			return n = !0, i = i ?? a?.value ?? null, a = null, g(), h(), e;
		},
		getBaseline() {
			return t;
		},
		getState: m,
		setBaseline(e, n) {
			t = e, r = n, h();
		},
		acceptLoaded(e, i) {
			if (n) return null;
			if (v()) return y(i ? { revision: i } : {}), null;
			let a = t;
			return t = e, r = i, h(), { shown: a };
		},
		handleChange(e) {
			n ? (i = e, h()) : o && e === i || (o = void 0, e === t && !a || a?.value === e ? (i = null, g(), h()) : (i = e, C(), h()));
		},
		handleRefreshEvent(t = {}) {
			n || t.resourceKey && t.resourceKey !== e.binding.resourceKey || b(t) || t.revision && d.has(t.revision) || (t.revision && d.add(t.revision), v() ? y(t) : t.revision && r && t.revision.localeCompare(r) <= 0 || e.load(t));
		},
		retry() {
			o && i !== null && !a && (o = void 0, h(), S());
		},
		retryLoad() {
			n || e.load({ resourceKey: e.binding.resourceKey });
		},
		flush() {
			g(), S();
		}
	};
}, Z = (e) => Array.isArray(e) ? e.map(Z) : !e || typeof e != "object" ? e : Object.fromEntries(Object.entries(e).sort(([e], [t]) => e.localeCompare(t)).map(([e, t]) => [e, Z(t)])), ie = (e) => {
	let { fileRendererId: t, resource: n } = e, r = n ? Z({
		id: n.id,
		type: n.type,
		metadata: n.metadata
	}) : null, i = `${JSON.stringify(w(n))}:${t}:${JSON.stringify(r)}`;
	return e.pageParams ? `${i}:${JSON.stringify(Z(e.pageParams))}` : i;
}, ae = (e, t) => e?.loadKey === t, Q = (e) => {
	let { fileName: t, filePath: n } = e, { activeFileIconTheme: r } = x();
	return /* @__PURE__ */ C(y, {
		variant: "narrow",
		flexShrink: 0,
		gap: "2xs",
		bg: "bg",
		children: [b(t, { theme: r }), /* @__PURE__ */ S(g, {
			"aria-label": `File path ${n}`,
			textStyle: "label/S/regular",
			color: "fg.muted",
			truncate: !0,
			children: n
		})]
	});
}, oe = 600, $ = (e) => e instanceof Error ? e.message : "Failed to load file.", se = (t) => {
	let { workbench: n, navigation: r, sectionId: i } = t;
	if (!r || !e(n).getTreeRenderer(r.treeId)) return;
	if (i && r.anchors.some((e) => e.id === i)) {
		e(n).setSelectedNode(r.treeId, i);
		return;
	}
	let a = e(n).getTreeState(r.treeId).selectedNodeId;
	a && r.anchors.some((e) => e.id === a) && e(n).setSelectedNode(r.treeId, void 0);
}, ce = (t, n) => {
	if (!n) return;
	let r = e(t).getTreeRenderer(n.treeId) ? e(t).getTreeState(n.treeId).selectedNodeId : void 0;
	return {
		anchors: n.anchors,
		targetId: R(n, r)
	};
}, le = (e) => {
	let { file: t } = e;
	return t.filePath ? /* @__PURE__ */ S(Q, {
		fileName: t.fileName ?? t.filePath,
		filePath: t.filePath
	}) : null;
}, ue = (e, n, r) => e ? t(e) : JSON.stringify([
	"file",
	n,
	r
]), de = (t) => {
	let { workbench: i, contribution: a } = t, m = t.placement?.resource, h = t.placement?.position, _ = ne(m), v = t.placement?.section, y = v?.anchors.at(-1), b = v && y ? {
		anchors: [...v.anchors],
		targetId: y.id
	} : ce(i, _), x = n(i, t.placement), T = ie({
		fileRendererId: a.id,
		resource: m,
		pageParams: x
	}), [E, D] = l(null), [O, k] = l(null), [A, j] = l({
		dirty: !1,
		saving: !1
	}), M = c(null), P = c(void 0), I = c(null), L = c(null);
	o(() => {
		let t = L.current, n = t && e(i).getTreeRenderer(t.treeId) ? e(i).getTreeState(t.treeId).selectedNodeId : void 0;
		z({
			previous: t,
			current: _,
			currentResourceKey: w(m),
			selectedNodeId: n
		}) && t && e(i).setSelectedNode(t.treeId, void 0), L.current = _ ? {
			resourceKey: w(m),
			treeId: _.treeId,
			anchorIds: _.anchors.map((e) => e.id)
		} : null;
	}, [
		m,
		_,
		i
	]);
	let R = c(a), B = c(m), V = c(x), H = c(t.placement);
	s(() => {
		R.current = a, B.current = m, V.current = x, H.current = t.placement;
	});
	let U = a.id, W = !!a.save, G = ue(t.placement, U, T), K = t.placement?.instanceId ?? U;
	s(() => {
		let t = !1, n = !1, r = B.current, a = R.current, o = i.views.reads.bind(G), s = null;
		k(null);
		let c = ee(T), l = c;
		D(c ? {
			...c,
			editorRevision: 1,
			loadKey: T
		} : null);
		let u = (e = "refresh") => {
			o.request({
				queryKey: T,
				load: (e) => R.current.load(B.current, e, V.current),
				onValue: (e) => {
					if (t || n) return;
					let r = te(e, T, s);
					r && (l = e, k(null), D(r));
				},
				onError: (e) => {
					t || n || k({
						loadKey: T,
						message: $(e)
					});
				}
			}, e);
		};
		P.current = () => u("retry"), s = W ? re({
			binding: {
				rendererId: U,
				instanceId: K,
				resourceKey: w(B.current)
			},
			debounceMs: oe,
			load: () => u(),
			onStateChange: (e) => {
				t || j(e);
			},
			save: async (e, t) => {
				let i = await F(a, r, e, t, l);
				return l = i.content, l && !n && N(T, l), i.result;
			}
		}) : null, M.current = s, c && M.current?.setBaseline(c.content, c.revision), j({
			dirty: !1,
			saving: !1
		}), u();
		let d = i.resources.onWillRemove((e) => {
			if (w(e) !== w(B.current)) return [];
			n = !0;
			let t = M.current?.markRemoved(), r = H.current?.placementIdentity;
			return t && r ? [r] : [];
		}), f = e(i).onDidRefreshFileRenderer((e) => {
			if (n || e.fileRendererId !== U) return;
			let t = M.current;
			t ? t.handleRefreshEvent(e) : u();
		});
		return () => {
			t = !0, o.dispose(), P.current = void 0, f.dispose(), d.dispose(), s?.flush(), M.current === s && (M.current = null);
		};
	}, [
		U,
		W,
		i,
		T,
		G,
		K
	]), o(() => {
		let e = () => M.current?.flush(), t = () => {
			document.visibilityState === "hidden" && e();
		};
		return window.addEventListener("beforeunload", e), document.addEventListener("visibilitychange", t), () => {
			window.removeEventListener("beforeunload", e), document.removeEventListener("visibilitychange", t);
		};
	}, []);
	let q = (e) => {
		M.current?.handleChange(e);
	}, J = ae(E, T) ? E : null, Y = O?.loadKey === T ? O.message : void 0;
	if (Y && !J) return /* @__PURE__ */ C(f, {
		h: "full",
		minH: "0",
		bg: "bg",
		p: "md",
		flexDirection: "column",
		gap: "sm",
		children: [/* @__PURE__ */ S(g, {
			color: "fg.muted",
			children: Y
		}), /* @__PURE__ */ S(d, {
			size: "xs",
			variant: "subtle",
			onClick: () => P.current?.(),
			children: "Retry"
		})]
	});
	let Z = J ? `${J.loadKey}:${J.editorRevision}` : "", Q = null;
	return A.removed ? Q = /* @__PURE__ */ S(r, { message: "This resource was removed. Your draft is kept here. Copy it before closing this tab." }) : Y ? Q = /* @__PURE__ */ S(r, {
		message: Y,
		onRetry: () => P.current?.()
	}) : A.saveError && (Q = /* @__PURE__ */ S(r, {
		message: A.saveError,
		onRetry: () => M.current?.retry()
	})), /* @__PURE__ */ C(p, {
		direction: "column",
		h: "full",
		minH: "0",
		bg: "bg",
		children: [J && /* @__PURE__ */ S(le, { file: J }), /* @__PURE__ */ S(u, {
			flex: "1",
			minH: "0",
			children: /* @__PURE__ */ S(X, {
				content: J,
				position: h,
				editorKey: Z,
				errorNotice: Q,
				contributionCanSave: !!a.save,
				onActiveSectionChange: _ ? (e) => se({
					workbench: i,
					navigation: _,
					sectionId: e
				}) : void 0,
				onChange: q,
				rendererRef: I,
				sectionNavigation: b,
				title: a.title
			})
		})]
	});
};
export { D as i, M as n, O as r, de as t };
