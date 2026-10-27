import { expect, test } from "bun:test";
import { createHarnessAccountCommandHandler, harnessAccountCommand } from "./harness-account-command";

test("recognizes account commands without treating ordinary chat text as account actions", () => {
  expect(harnessAccountCommand(" /login ")).toEqual({ action: "login", argument: "" });
  expect(harnessAccountCommand("/logout")).toEqual({ action: "logout", argument: "" });
  expect(harnessAccountCommand("Explain /login")).toBeNull();
  expect(harnessAccountCommand("/login-example")).toBeNull();
  expect(harnessAccountCommand("/login unsupported")).toEqual({ action: "login", argument: "unsupported" });
});

test("account commands stay local when account setup cannot start", async () => {
  const unavailable = Error("Account setup unavailable");
  const handler = createHarnessAccountCommandHandler({
    start: () => unavailable,
    rejectArguments: () => Error("No arguments"),
  });
  let submitted = false;
  for (const text of ["/login", "/logout"]) {
    expect(handler.isCommand(text)).toBe(true);
    const result = handler.submit(text, () => {
      submitted = true;
    });
    expect(result).toBeDefined();
    await expect(result!).rejects.toBe(unavailable);
  }
  expect(submitted).toBe(false);
  expect(handler.submit("ordinary chat")).toBeUndefined();
});

test("local account commands route actions and reject arguments", async () => {
  const actions: string[] = [];
  const invalid = Error("No arguments");
  const handler = createHarnessAccountCommandHandler({
    start: (action) => {
      actions.push(action);
      return undefined;
    },
    rejectArguments: () => invalid,
  });
  let submitted = false;
  await handler.submit("/login", () => {
    submitted = true;
  });
  expect(actions).toEqual(["login"]);
  expect(submitted).toBe(true);
  await expect(handler.submit("/logout extra")!).rejects.toBe(invalid);
  expect(actions).toEqual(["login"]);
});
