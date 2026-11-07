import { expect, test } from "bun:test";
import { ChatDeviceMenu } from "./device-menu";

test("device choice requires alternatives while saved device identity stays readable", () => {
  const choices: string[] = [];
  const props = { selectedDeviceId: "laptop", onSelectDevice: (id: string) => choices.push(id) };
  expect(ChatDeviceMenu({ ...props, devices: [] })).toBeNull();
  expect(ChatDeviceMenu({ ...props, devices: [{ id: "laptop", name: "Laptop" }] })).toBeNull();
  const menu = ChatDeviceMenu({
    ...props,
    devices: [
      { id: "", name: "This device", current: true },
      { id: "laptop", name: "Laptop" },
    ],
  });
  expect(menu).not.toBeNull();
  menu!.props.items[1].onSelect();
  expect(choices).toEqual(["laptop"]);
  const saved = ChatDeviceMenu({ ...props, devices: [{ id: "laptop", name: "Laptop" }], isDisabled: true });
  expect(saved!.props.children.props["data-testid"]).toBe("session-device");
  expect(saved!.props.content).toBe("Runs on Laptop");
});
