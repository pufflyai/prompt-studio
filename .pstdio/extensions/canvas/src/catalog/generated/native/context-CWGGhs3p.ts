// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { createContext as e } from "react";
// node_modules/.bun/react-i18next@16.5.8+d976778d4c9f401e/node_modules/react-i18next/dist/es/context.js
var t = e(), n = class {
	constructor() {
		this.usedNamespaces = {};
	}
	addUsedNamespaces(e) {
		e.forEach((e) => {
			this.usedNamespaces[e] || (this.usedNamespaces[e] = !0);
		});
	}
	getUsedNamespaces() {
		return Object.keys(this.usedNamespaces);
	}
};
export { n, t };
