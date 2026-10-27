// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./folder-plus-DzlYc4m_.ts";
import { t } from "./useTranslation-DvWg4zeU.ts";
import { t as n } from "./use-action-error-DjeAuY1I.ts";
import { useState as r } from "react";
import { HStack as i, Icon as a, Spinner as o, Stack as s, Text as c } from "@chakra-ui/react";
import { jsx as l, jsxs as u } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/settings/components/read-dropped-folder.ts
var d = /* @__PURE__ */ new Set(["node_modules"]), f = (e) => new Promise((t, n) => e.readEntries(t, n)), p = async (e) => {
	let t = e.createReader(), n = [];
	for (let e = await f(t); e.length > 0; e = await f(t)) n.push(...e);
	return n;
}, m = (e) => new Promise((t, n) => e.file(t, n)), h = async (e, t) => {
	let n = [];
	for (let r of await p(e)) {
		let e = `${t}${r.name}`;
		if (r.isDirectory && !d.has(r.name) && n.push(...await h(r, `${e}/`)), r.isFile) {
			let t = await m(r);
			n.push(new File([t], e, { type: t.type }));
		}
	}
	return n;
}, g = async (e) => ({
	name: e.name,
	files: await h(e, "")
}), _ = (e) => e.dataTransfer.types.includes("Files"), v = (d) => {
	let { addingName: f, onDropFolder: p } = d, { showError: m, errorNotice: h, clearError: v } = n(), { t: y } = t("projects"), [b, x] = r(!1), S = f !== void 0, C = (e) => {
		!S && _(e) && (e.preventDefault(), e.dataTransfer.dropEffect = "copy", x(!0));
	}, w = (e) => {
		e.currentTarget.contains(e.relatedTarget) || x(!1);
	}, T = async (e) => {
		if (e.preventDefault(), x(!1), S) return;
		v();
		let t = e.dataTransfer.items[0]?.webkitGetAsEntry();
		if (!t?.isDirectory) m({ title: y("projectSettings.extensionsPanel.dropZone.notFolder") });
		else try {
			p(await g(t));
		} catch (e) {
			m({
				title: y("projectSettings.extensionsPanel.dropZone.failed"),
				description: e instanceof Error ? e.message : void 0
			});
		}
	};
	return /* @__PURE__ */ u(s, {
		layerStyle: b ? "dropZone.active" : "dropZone.idle",
		alignItems: "center",
		gap: "2xs",
		paddingX: "lg",
		paddingY: "md",
		color: "fg.muted",
		onDragEnter: C,
		onDragOver: C,
		onDragLeave: w,
		onDrop: (e) => void T(e),
		"data-testid": "extension-folder-drop-zone",
		children: [
			h,
			/* @__PURE__ */ u(i, {
				gap: "xs",
				children: [S ? /* @__PURE__ */ l(o, { size: "xs" }) : /* @__PURE__ */ l(a, {
					boxSize: "4",
					children: /* @__PURE__ */ l(e, {})
				}), /* @__PURE__ */ l(c, {
					textStyle: "label/S/medium",
					children: S ? y("projectSettings.extensionsPanel.dropZone.uploading", { name: f }) : y("projectSettings.extensionsPanel.dropZone.title")
				})]
			}),
			/* @__PURE__ */ l(c, {
				textStyle: "label/XS",
				color: "fg.subtle",
				children: y("projectSettings.extensionsPanel.dropZone.hint")
			})
		]
	});
};
export { v as t };
