// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { i as e } from "./rolldown-runtime-CwxnZyOB.ts";
import { t } from "./alert-D8nHP1tF.ts";
import { useEffect as n, useState as r } from "react";
import { Box as i, Button as a } from "@chakra-ui/react";
import { jsx as o } from "react/jsx-runtime";
// packages/ui/src/utils/prism.ts
var s = (e) => e.default ?? e, c = async () => {
	let t = globalThis;
	t.Prism ||= s(await import("./prism-DZpbz-dA.ts").then((t) => /* @__PURE__ */ e(t.t(), 1)));
}, l = (e) => {
	let [s, l] = r({ kind: "loading" });
	if (n(() => {
		let e = !1;
		return (async () => {
			try {
				await c();
				let t = await import("./markdown-editor-w_pQ9qpB.ts").then((e) => e.n);
				e || l({
					kind: "ready",
					Editor: t.MarkdownEditor
				});
			} catch {
				e || l({ kind: "failed" });
			}
		})(), () => {
			e = !0;
		};
	}, []), s.kind === "ready") {
		let { Editor: t } = s;
		return /* @__PURE__ */ o(t, { ...e });
	}
	return s.kind === "failed" ? /* @__PURE__ */ o(t, {
		status: "error",
		title: "Could not load the editor",
		endElement: /* @__PURE__ */ o(a, {
			onClick: () => window.location.reload(),
			children: "Reload"
		})
	}) : /* @__PURE__ */ o(i, {
		minH: "7rem",
		borderWidth: "1px",
		borderColor: "border",
		borderRadius: "xs"
	});
};
export { l as t };
