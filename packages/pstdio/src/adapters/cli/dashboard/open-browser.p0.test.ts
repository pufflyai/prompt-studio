import { expect, test } from "bun:test";
import { openBrowser } from "./open-browser";

const capture = () => {
  const calls: Array<{ file: string; args: string[] }> = [];
  return { calls, opener: (file: string, args: string[]) => void calls.push({ file, args }) };
};

// The URL is passed as one argument, never through a shell, so quotes or `&` in it cannot run commands.
const url = 'http://127.0.0.1:5555/runtime/browser-login?code=a"b&c';

test("opens the URL with open on darwin", () => {
  const { calls, opener } = capture();
  openBrowser(url, "darwin", opener);
  expect(calls).toEqual([{ file: "open", args: [url] }]);
});

test("opens the URL with xdg-open on linux", () => {
  const { calls, opener } = capture();
  openBrowser(url, "linux", opener);
  expect(calls).toEqual([{ file: "xdg-open", args: [url] }]);
});

test("opens the URL with the URL protocol handler on win32", () => {
  const { calls, opener } = capture();
  openBrowser(url, "win32", opener);
  expect(calls).toEqual([{ file: "rundll32", args: ["url.dll,FileProtocolHandler", url] }]);
});
