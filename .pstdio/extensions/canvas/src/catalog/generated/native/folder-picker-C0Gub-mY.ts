// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e } from "./api-D3Fkqs7r.ts";
import { useEffect as t, useState as n } from "react";
import { FolderPicker as r } from "@pstdio/ui";
import { jsx as i } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/shared/filesystem/file-system-api.ts
var a = (t) => e().filesystem.list(t?.trim() || void 0), o = () => e().filesystem.drives(), s = (t, n) => e().filesystem.createDirectory({
	parent_path: t,
	name: n
}), c = (e) => {
	let [c, l] = n({ path: "~" }), u = (e) => l({ path: e }), [d, f] = n(), [p, m] = n([]), [h, g] = n(!0), [_, v] = n("");
	t(() => {
		let e = !1;
		return o().then((t) => {
			e || m(t.drives);
		}).catch((t) => {
			e || v(t instanceof Error ? t.message : String(t));
		}), () => {
			e = !0;
		};
	}, []), t(() => {
		let e = !1;
		return g(!0), v(""), f(void 0), a(c.path).then((t) => {
			e || f(t);
		}).catch((t) => {
			e || v(t instanceof Error ? t.message : String(t));
		}).finally(() => {
			e || g(!1);
		}), () => {
			e = !0;
		};
	}, [c]);
	let y = d?.currentPath ?? (c.path === "~" ? "" : c.path);
	return /* @__PURE__ */ i(r, {
		currentPath: y,
		entries: d?.entries ?? [],
		drives: p,
		isUnavailable: !d && !h,
		isLoading: h,
		isOpening: e.isOpening,
		error: _ || e.error,
		onClose: e.onClose,
		onSelect: () => {
			e.onSelect(y);
		},
		onNavigate: u,
		onCreateFolder: async (e) => {
			v("");
			try {
				let t = await s(y, e);
				u(t.path);
			} catch (e) {
				throw v(e instanceof Error ? e.message : String(e)), e;
			}
		}
	});
};
export { c as t };
