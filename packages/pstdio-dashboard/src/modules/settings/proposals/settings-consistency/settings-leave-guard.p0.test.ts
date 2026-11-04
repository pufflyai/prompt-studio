import { expect, test } from "bun:test";
import { createSettingsLeaveGuard } from "./settings-leave-guard";

test("leaving a dirty page waits for a decision and Stay keeps its draft", () => {
  let title: string | null = null;
  let left = false;
  const guard = createSettingsLeaveGuard((next) => {
    title = next;
  });
  guard.register({ title: "Ticket tags", dirty: true, save() {}, reset() {} });
  guard.request(() => {
    left = true;
  });
  expect(title).toBe("Ticket tags");
  expect(left).toBe(false);
  guard.stay();
  guard.leave(false);
  expect(left).toBe(false);
  expect(title).toBeNull();
});

test.each([true, false])("leaving resolves the draft before navigation (save: %s)", (save) => {
  const events: string[] = [];
  const guard = createSettingsLeaveGuard(() => {});
  guard.register({
    title: "Runtime",
    dirty: true,
    save: () => {
      events.push("save");
    },
    reset: () => {
      events.push("reset");
    },
  });
  guard.request(() => {
    events.push("leave");
  });
  guard.leave(save);
  expect(events).toEqual([save ? "save" : "reset", "leave"]);
});

test("clean pages leave immediately and failed saves keep the warning open", () => {
  let title: string | null = null;
  let left = 0;
  const guard = createSettingsLeaveGuard((next) => {
    title = next;
  });
  guard.request(() => {
    left++;
  });
  expect(left).toBe(1);
  guard.register({
    title: "Project folder",
    dirty: true,
    save() {
      throw new Error("Save failed");
    },
    reset() {},
  });
  guard.request(() => {
    left++;
  });
  expect(() => guard.leave(true)).toThrow("Save failed");
  expect(left).toBe(1);
  expect(title).toBe("Project folder");
});
