import { expect, test } from "bun:test";
import { ownedProcesses } from "./owned-processes";

test("attributes descendants and surviving process-group members without claiming unrelated work", () => {
  const table = [
    { pid: 10, parentPid: 1, groupId: 10 },
    { pid: 20, parentPid: 10, groupId: 10 },
    { pid: 30, parentPid: 20, groupId: 30 },
    { pid: 40, parentPid: 1, groupId: 10 },
    { pid: 50, parentPid: 1, groupId: 50 },
  ];
  expect(ownedProcesses(10, table).map((process) => process.pid)).toEqual([10, 20, 30, 40]);
  expect(ownedProcesses(20, table).map((process) => process.pid)).toEqual([20, 30]);
});
