// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./queryClient-BgKKh9f4.ts";
import { useState as n } from "react";
import { jsx as r } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/projects/data/project-story-fixture.tsx
var i = (i) => {
	let { children: a } = i, [o] = n(() => {
		let e = new t({ defaultOptions: { queries: { enabled: !1 } } });
		return e.setQueryData(["account-status"], { cloudProjects: [] }), e;
	});
	return /* @__PURE__ */ r(e, {
		client: o,
		children: a
	});
};
export { i as t };
