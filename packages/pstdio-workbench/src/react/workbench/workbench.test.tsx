import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createWorkbenchCore } from "../../core";
import { Workbench } from "./workbench";

describe("Workbench", () => {
  test("owns the UI theme providers needed by the React shell", () => {
    const markup = renderToStaticMarkup(<Workbench workbench={createWorkbenchCore()} />);

    expect(markup.length).toBeGreaterThan(0);
  });
});
