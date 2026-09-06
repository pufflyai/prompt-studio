import { expect, test } from "bun:test";
import { defaultPageResourceCodec } from "./page-resource-codec";

test("preserves resource ownership when a route is reloaded", () => {
  const resource = { type: "note", id: "a/b ?", extensionId: "acme.notes", projectId: "project-1" };
  expect(defaultPageResourceCodec.fromUri(defaultPageResourceCodec.toUri(resource))).toEqual(resource);
  expect(defaultPageResourceCodec.toUri({ ...resource, extensionId: "other.notes" })).not.toBe(
    defaultPageResourceCodec.toUri(resource),
  );
});

test("keeps existing resource URLs valid", () => {
  const resource = { type: "workspace", id: "workspace-1" };
  expect(defaultPageResourceCodec.toUri(resource)).toBe("pstdio://extension-resource/workspace/workspace-1");
  expect(defaultPageResourceCodec.fromUri("pstdio://extension-resource/workspace/workspace-1")).toEqual(resource);
});
