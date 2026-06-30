import { useEffect, useState } from "react";
import {
  formatPerformanceMs,
  installPerformanceFrameRateSampler,
  PerformancePanel,
  readPerformanceFrameRateSnapshot,
} from "@/components/internal/performance-panel";
import { type ChatMountMetric, readLatestChatMountMetric } from "./chat-mount-metrics";

export type ChatPerfSample = {
  scenario: string;
  phase: string;
  actualDuration: number;
  baseDuration: number;
  commitTime: number;
};

type PanelSnapshot = {
  latestMountMetric: ChatMountMetric | null;
  framesPerSecond: number | null;
  averageFramesPerSecond: number | null;
  frameRateSamples: number[];
};

declare global {
  interface Window {
    __chatPanelPerf?: ChatPerfSample[];
  }
}

export const ensureChatPerfBuffer = () => {
  if (typeof window === "undefined") return null;
  window.__chatPanelPerf ??= [];
  return window.__chatPanelPerf;
};

const readPanelSnapshot = (scenario: string): PanelSnapshot => {
  if (typeof window === "undefined" || typeof performance === "undefined") {
    return {
      latestMountMetric: null,
      framesPerSecond: null,
      averageFramesPerSecond: null,
      frameRateSamples: [],
    };
  }
  const frameRate = readPerformanceFrameRateSnapshot();

  return {
    latestMountMetric: readLatestChatMountMetric(scenario),
    framesPerSecond: frameRate.framesPerSecond,
    averageFramesPerSecond: frameRate.averageFramesPerSecond,
    frameRateSamples: frameRate.frameRateSamples,
  };
};

export const ChatPerformancePanel = (props: { scenario: string; messageCount: number }) => {
  const { scenario, messageCount } = props;
  const [snapshot, setSnapshot] = useState(() => readPanelSnapshot(scenario));
  const latestMountMetric = snapshot.latestMountMetric;

  useEffect(() => {
    ensureChatPerfBuffer();
    installPerformanceFrameRateSampler();
    setSnapshot(readPanelSnapshot(scenario));

    const intervalId = window.setInterval(() => {
      setSnapshot(readPanelSnapshot(scenario));
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [scenario]);

  return (
    <PerformancePanel
      subtitle={latestMountMetric?.label ?? "mount pending"}
      badgeLabel={`${messageCount} messages`}
      metrics={[
        { label: "Mount total", value: formatPerformanceMs(latestMountMetric?.totalMs ?? null) },
        { label: "Mount / message", value: formatPerformanceMs(latestMountMetric?.perMessageMs ?? null) },
      ]}
      framesPerSecond={snapshot.framesPerSecond}
      averageFramesPerSecond={snapshot.averageFramesPerSecond}
      frameRateSamples={snapshot.frameRateSamples}
      testId="chat-perf-panel"
    />
  );
};
