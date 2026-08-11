import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const readState = (path: string) => {
  if (!existsSync(path)) return {};
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
};

export class DesktopWorkbenchStateStore {
  readonly #path: string;
  readonly #values: Record<string, string>;

  constructor(path: string) {
    this.#path = path;
    this.#values = readState(path);
  }

  getAll() {
    return { ...this.#values };
  }

  setItem(key: string, value: string | null) {
    if (value === null) delete this.#values[key];
    else this.#values[key] = value;
    mkdirSync(dirname(this.#path), { recursive: true });
    writeFileSync(this.#path, `${JSON.stringify(this.#values, null, 2)}\n`, "utf8");
  }
}
