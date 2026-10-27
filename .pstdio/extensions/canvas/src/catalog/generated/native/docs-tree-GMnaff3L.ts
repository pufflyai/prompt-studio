// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./docs-topics-BT1I3HP5.ts";
// clients/landing-page/src/services/docs-tree.ts
var n = (n) => t.map((t) => ({
	section: t,
	topics: e.filter((e) => e.section === t).map((e) => ({
		topic: e,
		pages: n.filter((t) => t.view === "doc" && t.path.startsWith(e.path))
	})).filter((e) => e.pages.length > 0)
})).filter((e) => e.topics.length > 0);
export { n as t };
