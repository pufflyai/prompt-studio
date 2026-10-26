import { expect, test } from "bun:test";
import { harnessAccountCommand } from "./harness-account-command";

test("recognizes account commands without treating ordinary chat text as account actions", () => {
  expect(harnessAccountCommand(" /login ")).toEqual({ action: "login", argument: "" });
  expect(harnessAccountCommand("/logout")).toEqual({ action: "logout", argument: "" });
  expect(harnessAccountCommand("Explain /login")).toBeNull();
  expect(harnessAccountCommand("/login-example")).toBeNull();
  expect(harnessAccountCommand("/login unsupported")).toEqual({ action: "login", argument: "unsupported" });
});
