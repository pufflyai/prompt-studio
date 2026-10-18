import { expect, test } from "bun:test";
import type { ResourceRef } from "../../core";
import { breadcrumbSnapshot } from "./breadcrumb-snapshot";

const referenceKey = (resource: ResourceRef) => JSON.stringify([resource.id, resource.metadata?.document]);
const ticket = { type: "ticket", id: "one" };
const document = { ...ticket, metadata: { document: "brief" } };
const parent = { title: "Ticket", resource: ticket };
const current = { title: "Brief", resource: document };
const snapshot = { menu: [{ id: "document", rows: [{ id: "edit", label: "Edit document" }] }] };

test("parent resource menus do not inherit the current document's view controls", () => {
  expect(breadcrumbSnapshot(parent, current, document, snapshot, referenceKey)).toEqual({});
  expect(breadcrumbSnapshot(current, current, document, snapshot, referenceKey)).toBe(snapshot);
});

test("only the current breadcrumb receives its view's controls when resources repeat", () => {
  const repeatedParent = { title: "Parent", resource: document };
  expect(breadcrumbSnapshot(repeatedParent, current, document, snapshot, referenceKey)).toEqual({});
});

test("another document on the same resource does not receive this view's controls", () => {
  const other = { title: "Other document", resource: { ...ticket, metadata: { document: "other" } } };
  expect(breadcrumbSnapshot(other, other, document, snapshot, referenceKey)).toEqual({});
});
