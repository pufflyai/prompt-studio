// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
// node_modules/.bun/d3-scale@4.0.2/node_modules/d3-scale/src/init.js
function e(e, t) {
	switch (arguments.length) {
		case 0: break;
		case 1:
			this.range(e);
			break;
		default: this.range(t).domain(e);
	}
	return this;
}
function t(e, t) {
	switch (arguments.length) {
		case 0: break;
		case 1:
			typeof e == "function" ? this.interpolator(e) : this.range(e);
			break;
		default: this.domain(e), typeof t == "function" ? this.interpolator(t) : this.range(t);
	}
	return this;
}
export { e as n, t };
