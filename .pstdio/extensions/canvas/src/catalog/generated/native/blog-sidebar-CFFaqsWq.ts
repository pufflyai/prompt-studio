// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./newspaper-DQI2-Eer.ts";
import { ListRow as t } from "@pstdio/ui";
import { jsx as n } from "react/jsx-runtime";
// clients/landing-page/src/components/blog/blog-sidebar.tsx
var r = (r) => {
	let { page: i, pages: a } = r;
	return [{
		path: "/blog/",
		label: "All posts",
		icon: /* @__PURE__ */ n(e, {})
	}, ...a.filter((e) => e.view === "post").map((e) => ({
		path: e.path,
		label: e.label,
		icon: void 0
	}))].map((e) => /* @__PURE__ */ n(t, {
		icon: e.icon,
		label: e.label,
		href: e.path,
		role: "link",
		isSelected: e.path === i.path,
		"aria-current": e.path === i.path ? "page" : void 0
	}, e.path));
};
export { r as BlogSidebar };
