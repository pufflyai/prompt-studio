import { expect, test } from "bun:test";
import { type KanbanRendererEnumOption, l10n, type NavigationTarget } from "@pstdio/sdk/extensions";
import { localizeTicketFormOption } from "./ticket-create-form";

test("ticket choices localize note and menu actions and forward their navigation targets", () => {
  const noteAction: NavigationTarget = { kind: "href", href: "https://example.test/details" };
  const menuAction: NavigationTarget = { kind: "href", href: "https://example.test/manage" };
  const opened: NavigationTarget[] = [];
  const wire: KanbanRendererEnumOption = {
    value: "review",
    label: l10n("review", "Review"),
    note: l10n("review.note", "Details"),
    color: "blue",
    noteAction,
    contextMenuActions: [{ id: "manage", label: l10n("manage", "Manage"), action: menuAction, disabled: false }],
  };
  const labels: Record<string, string> = { review: "Révision", "review.note": "Détails", manage: "Gérer" };
  const option = localizeTicketFormOption(
    wire,
    (key, fallback) => labels[key] ?? fallback ?? key,
    (target) => {
      opened.push(target);
    },
  );
  expect(option.label).toBe("Révision");
  expect(option.note).toBe("Détails");
  expect(option.color).toBe("blue");
  expect(option.onNoteClick).toBeFunction();
  option.onNoteClick?.();
  const action = option.contextMenuActions?.[0];
  expect(action?.label).toBe("Gérer");
  expect(action?.disabled).toBe(false);
  expect(action?.onAction).toBeFunction();
  action?.onAction();
  expect(opened).toEqual([noteAction, menuAction]);
});
