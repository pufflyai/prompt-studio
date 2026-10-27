// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Badge as e, HStack as t } from "@chakra-ui/react";
import { jsx as n } from "react/jsx-runtime";
// packages/ui/src/components/data-table/data-table.story-fixtures.tsx
var r = [
	"Northwind Traders",
	"Fabrikam Logistics",
	"Contoso Supplies",
	"Adventure Works"
], i = [
	"North America",
	"Europe",
	"APAC",
	"LATAM"
], a = [
	"Finance",
	"Operations",
	"Logistics",
	"Procurement"
], o = [
	"Low",
	"Medium",
	"High"
], s = [
	"Wire",
	"Card",
	"ACH",
	"Check"
], c = [
	{
		label: "Paid",
		colorPalette: "green"
	},
	{
		label: "Pending",
		colorPalette: "yellow"
	},
	{
		label: "Overdue",
		colorPalette: "red"
	}
], l = (t, r) => ({
	display: /* @__PURE__ */ n(e, {
		colorPalette: r,
		variant: "subtle",
		textStyle: "label/S/medium",
		px: "xs",
		py: "4px",
		children: t
	}),
	sortValue: t
}), u = (r) => ({
	display: /* @__PURE__ */ n(t, {
		gap: "2xs",
		flexWrap: "wrap",
		children: r.map((t) => /* @__PURE__ */ n(e, {
			variant: "outline",
			colorPalette: "gray",
			textStyle: "label/XS/medium",
			children: t
		}, t))
	}),
	sortValue: r.join(", ")
}), d = [
	{
		id: "inv-001",
		Invoice: "INV-001",
		Vendor: r[0],
		"Due Date": "2024-06-12",
		Amount: 1280.5,
		Approved: !0,
		Status: l(c[0].label, c[0].colorPalette),
		Region: i[0],
		Department: a[0],
		Priority: o[2],
		"Payment Method": s[0]
	},
	{
		id: "inv-002",
		Invoice: "INV-002",
		Vendor: r[1],
		"Due Date": "2024-06-18",
		Amount: 812.2,
		Approved: !1,
		Status: l(c[1].label, c[1].colorPalette),
		Region: i[1],
		Department: a[1],
		Priority: o[1],
		"Payment Method": s[1]
	},
	{
		id: "inv-003",
		Invoice: "INV-003",
		Vendor: r[2],
		"Due Date": "2024-06-25",
		Amount: 2640,
		Approved: !0,
		Status: l(c[2].label, c[2].colorPalette),
		Region: i[2],
		Department: a[2],
		Priority: o[0],
		"Payment Method": s[2]
	}
], f = (e) => {
	let t = [];
	for (let n = 0; n < e; n++) {
		let e = n + 1, d = e.toString().padStart(4, "0"), f = c[n % c.length], p = String(n % 12 + 1).padStart(2, "0"), m = String(n % 28 + 1).padStart(2, "0"), h = i[n % i.length], g = o[n % o.length];
		t.push({
			id: `inv-${d}`,
			Invoice: `INV-${d}`,
			Vendor: r[n % r.length],
			"Due Date": `2024-${p}-${m}`,
			Amount: Number((950 + e * 3.25).toFixed(2)),
			Approved: e % 2 == 0,
			Status: l(f.label, f.colorPalette),
			Region: h,
			Department: a[n % a.length],
			Priority: g,
			"Payment Method": s[n % s.length],
			Tags: u([h, g])
		});
	}
	return t;
}, p = f(1e3), m = f(24).map((e, t) => {
	let n = i[t % i.length], r = o[t % o.length];
	return {
		...e,
		Vendor: `${e.Vendor} - Enterprise Shared Services and Procurement Operations ${t + 1}`,
		Tags: u([
			n,
			r,
			"multi-market",
			"renewal",
			"quarter-close",
			"needs-review"
		])
	};
}), h = (e, t) => {
	let n = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="20" fill="${t}"/><text x="48" y="57" text-anchor="middle" font-family="Arial" font-size="30" fill="white">${e}</text></svg>`;
	return `data:image/svg+xml,${encodeURIComponent(n)}`;
}, g = [
	{
		id: "customer-1",
		Customer: "Mina Patel",
		Segment: "Growing business",
		Profile: {
			avatar: h("MP", "#6D5BD0"),
			gallery: [
				h("01", "#C05A7A"),
				h("02", "#427AA1"),
				h("03", "#4F8A5B")
			],
			contact: {
				email: "mina@northstar.co",
				phone: "+46 70 555 01 42"
			},
			location: {
				city: "Stockholm",
				country: "Sweden"
			},
			interests: [
				"Design",
				"Travel",
				"Sustainability"
			],
			verified: !0
		}
	},
	{
		id: "customer-2",
		Customer: "Jordan Lee",
		Segment: "Enterprise",
		Profile: JSON.stringify({
			profileImage: h("JL", "#197278"),
			contact: {
				email: "jordan@atlas.group",
				phone: "+44 20 7946 0921"
			},
			location: {
				city: "London",
				country: "United Kingdom"
			},
			interests: ["Operations", "Cycling"],
			verified: !0
		})
	},
	{
		id: "customer-3",
		Customer: "Sam Rivera",
		Segment: "Independent",
		Profile: {
			photo: h("SR", "#D17B49"),
			contact: {
				email: "sam@example.com",
				phone: null
			},
			location: {
				city: "Madrid",
				country: "Spain"
			},
			interests: ["Photography", "Food"],
			verified: !1
		}
	}
];
export { p as a, d as i, g as n, f as r, m as t };
