import { describe, expect, it, mock } from "bun:test";
import { createHeartbeatMonitor } from "./heartbeat-monitor";

describe("createHeartbeatMonitor", () => {
  it("calls onConnectionLost after the threshold is exceeded", () => {
    const onConnectionLost = mock();
    const monitor = createHeartbeatMonitor({
      threshold: 3,
      onConnectionLost,
    });

    monitor.tick();
    monitor.tick();
    monitor.tick();
    expect(onConnectionLost).toHaveBeenCalledTimes(1);
  });

  it("does not call onConnectionLost before threshold", () => {
    const onConnectionLost = mock();
    const monitor = createHeartbeatMonitor({
      threshold: 3,
      onConnectionLost,
    });

    monitor.tick();
    monitor.tick();
    expect(onConnectionLost).not.toHaveBeenCalled();
  });

  it("resets the counter when a heartbeat is recorded", () => {
    const onConnectionLost = mock();
    const monitor = createHeartbeatMonitor({
      threshold: 3,
      onConnectionLost,
    });

    monitor.tick();
    monitor.tick();
    monitor.recordHeartbeat();
    monitor.tick();
    monitor.tick();

    expect(onConnectionLost).not.toHaveBeenCalled();
  });

  it("fires onConnectionLost only once until reset", () => {
    const onConnectionLost = mock();
    const monitor = createHeartbeatMonitor({
      threshold: 3,
      onConnectionLost,
    });

    monitor.tick();
    monitor.tick();
    monitor.tick();
    monitor.tick();
    monitor.tick();
    expect(onConnectionLost).toHaveBeenCalledTimes(1);
  });

  it("can fire again after a heartbeat resets the state", () => {
    const onConnectionLost = mock();
    const monitor = createHeartbeatMonitor({
      threshold: 3,
      onConnectionLost,
    });

    monitor.tick();
    monitor.tick();
    monitor.tick();
    expect(onConnectionLost).toHaveBeenCalledTimes(1);

    monitor.recordHeartbeat();
    monitor.tick();
    monitor.tick();
    monitor.tick();
    expect(onConnectionLost).toHaveBeenCalledTimes(2);
  });

  it("does not fire after stop", () => {
    const onConnectionLost = mock();
    const monitor = createHeartbeatMonitor({
      threshold: 3,
      onConnectionLost,
    });

    monitor.tick();
    monitor.stop();
    monitor.tick();
    monitor.tick();
    monitor.tick();

    expect(onConnectionLost).not.toHaveBeenCalled();
  });
});
