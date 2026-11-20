import type { CSSProperties, ReactNode } from "react";
import type { ToolExampleId } from "../../content/tool-examples-content";

const Row = (props: { swatch?: string; on?: boolean; children: ReactNode }) => {
  const { swatch, on, children } = props;
  return (
    <div className={on ? "rec-row rec-on" : "rec-row"}>
      <span className="rec-swatch" style={swatch ? ({ "--rec-swatch": swatch } as CSSProperties) : undefined} />
      {children}
    </div>
  );
};

const Heading = (props: { children: ReactNode }) => <div className="rec-heading">{props.children}</div>;

const Prop = (props: { label: string; value: string; rec?: string }) => (
  <>
    <span>{props.label}</span>
    <span className="rec-value" data-rec={props.rec}>
      {props.value}
    </span>
  </>
);

const Frame = (props: {
  id: string;
  title: string;
  left: number;
  top: number;
  width: number;
  height: number;
  children: ReactNode;
}) => {
  const { id, title, left, top, width, height, children } = props;
  return (
    <div className="rec-frame" data-frame={id} data-theme="light" style={{ left, top, width, height }}>
      <span className="rec-frame-title">{title}</span>
      {children}
    </div>
  );
};

const agent = (name: string) => `var(--chakra-colors-agent-${name})`;

/** Left, main, and right panel content for each recorded tool. */
export const RECORDING_PANES: Record<
  ToolExampleId,
  { left: ReactNode; main: ReactNode; right: ReactNode; bottom?: ReactNode }
> = {
  board: {
    left: (
      <>
        <Heading>Planner</Heading>
        <Row swatch="var(--chakra-colors-illustration-page)" on>
          Tool development
        </Row>
        <Row>Website</Row>
        <Row>Releases</Row>
        <Heading>Agents</Heading>
        <Row swatch={agent("claude")}>Claude Code</Row>
        <Row swatch={agent("codex")}>Codex</Row>
        <Row swatch={agent("opencode")}>OpenCode</Row>
      </>
    ),
    main: (
      <>
        <div className="rec-board-head">
          <b>Tool development</b>
          <span className="rec-muted" data-rec="board-count" />
        </div>
        <div className="rec-kanban" data-rec="kanban" />
      </>
    ),
    right: (
      <div className="rec-chat">
        <Heading>Chat · TOOL-16</Heading>
        <div className="rec-messages" data-rec="messages" />
        <div className="rec-composer">
          <span className="rec-composer-text" data-rec="composer" />
          <span className="rec-send" data-rec="send" />
        </div>
      </div>
    ),
  },
  image: {
    left: (
      <div className="rec-tools">
        {["V", "T", "R", "E", "B", "H"].map((key, i) => (
          <span key={key} className={i === 0 ? "rec-tool rec-on" : "rec-tool"}>
            {key}
          </span>
        ))}
      </div>
    ),
    main: (
      <div className="rec-artboard" data-rec="artboard">
        <div className="rec-layer rec-wave" data-layer="wave" />
        <div className="rec-layer rec-sun" data-layer="sun" />
        <div className="rec-layer rec-title" data-layer="title">
          Great Wave
        </div>
        <div className="rec-selection" data-rec="selection" />
      </div>
    ),
    right: (
      <>
        <Heading>Properties</Heading>
        <div className="rec-props">
          <Prop label="X" value="40" rec="prop-x" />
          <Prop label="Y" value="90" rec="prop-y" />
          <Prop label="W" value="300" />
          <Prop label="Opacity" value="100%" rec="prop-opacity" />
        </div>
        <div className="rec-slider" data-rec="slider">
          <span className="rec-slider-fill" data-rec="slider-fill" />
          <span className="rec-slider-knob" data-rec="slider-knob" />
        </div>
        <Heading>Layers</Heading>
        {["Title", "Sun", "Wave", "Paper"].map((name) => (
          <div key={name} className="rec-row" data-layer-row={name.toLowerCase()}>
            <span className="rec-swatch" />
            {name}
          </div>
        ))}
      </>
    ),
  },
  canvas: {
    left: (
      <>
        <Heading>Components</Heading>
        <Row swatch="var(--chakra-colors-illustration-editor)" on>
          Overview
        </Row>
        <Row>Button</Row>
        <Row>Card</Row>
        <Row>Chat composer</Row>
        <Heading>Pages</Heading>
        <Row>Settings</Row>
      </>
    ),
    main: (
      <div className="rec-canvas" data-rec="canvas">
        <div className="rec-world" data-rec="canvas-world">
          <Frame id="button" title="Button / Variants" left={90} top={60} width={230} height={96}>
            <div className="rec-frame-row">
              <span className="rec-chip rec-primary">Save</span>
              <span className="rec-chip">Cancel</span>
            </div>
          </Frame>
          <Frame id="card" title="Card / Example" left={360} top={60} width={220} height={150}>
            <span className="rec-avatar" />
            <b>Weekly report</b>
            <span className="rec-line" />
            <span className="rec-line rec-short" />
          </Frame>
          <Frame id="composer" title="Chat composer / Idle" left={90} top={200} width={230} height={110}>
            <span className="rec-input">Ask Codex…</span>
            <div className="rec-frame-row rec-end">
              <span className="rec-chip rec-primary">Send</span>
            </div>
          </Frame>
          <Frame id="chart" title="Chart / Weekly" left={360} top={250} width={220} height={120}>
            <div className="rec-bars">
              {[40, 65, 50, 85, 70].map((height) => (
                <i key={height} style={{ height: `${height}%` }} />
              ))}
            </div>
          </Frame>
        </div>
      </div>
    ),
    right: (
      <>
        <Heading>Frame</Heading>
        <div className="rec-props">
          <Prop label="Name" value="None selected" rec="frame-name" />
        </div>
        <Heading>Theme</Heading>
        <div className="rec-segments">
          <span className="rec-segment" data-theme-option="light" data-selected="true">
            Light
          </span>
          <span className="rec-segment" data-theme-option="dark">
            Dark
          </span>
        </div>
      </>
    ),
  },
  scene: {
    left: (
      <>
        <Heading>Scene</Heading>
        <Row>Camera</Row>
        <Row>Key light</Row>
        <Row swatch="var(--chakra-colors-illustration-editor)" on>
          Cube
        </Row>
        <Row>Floor</Row>
      </>
    ),
    main: (
      <div className="rec-viewport">
        <div className="rec-floor" />
        <div className="rec-cube" data-rec="cube">
          {["front", "back", "right", "left", "top", "bottom"].map((face) => (
            <i key={face} data-face={face} />
          ))}
        </div>
      </div>
    ),
    right: (
      <>
        <Heading>Inspector · Cube</Heading>
        <div className="rec-props">
          <Prop label="Rotate X" value="-22°" />
          <Prop label="Rotate Y" value="0°" rec="rotate-y" />
          <Prop label="Scale" value="1.00" />
          <Prop label="Material" value="Glass" />
        </div>
      </>
    ),
    bottom: (
      <div className="rec-timeline">
        <div className="rec-timeline-controls">
          <span className="rec-play" data-rec="play">
            ▶
          </span>
          <span className="rec-muted" data-rec="time" />
        </div>
        <div className="rec-ruler" />
        <div className="rec-tracks-names">
          <span>Cube · rotate</span>
          <span>Key light</span>
        </div>
        <div className="rec-tracks">
          {[
            [10, 0],
            [32, 0],
            [58, 0],
            [84, 0],
            [20, 1],
            [70, 1],
          ].map(([left, track], i) => (
            <span
              key={`${left}-${track}`}
              className="rec-keyframe"
              data-keyframe={i}
              data-track={track}
              style={{ left: `${left}%` }}
            />
          ))}
          <span className="rec-playhead" data-rec="playhead" />
        </div>
      </div>
    ),
  },
};
