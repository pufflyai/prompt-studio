import { resolveIconComponent } from "@pstdio/ui";
import {
  type DesignDocument,
  type DesignNode,
  type DesignTheme,
  defaultDesignTheme,
  expandDesign,
  resolveDesignValue,
} from "./model";
import { designNodeStyle } from "./styles";

interface NodeProps {
  document: DesignDocument;
  node: DesignNode;
  theme: DesignTheme;
  parent?: DesignNode;
  path: string;
}
const DesignElement = (props: NodeProps) => {
  const { document, node, parent, path } = props;
  const theme = { ...props.theme, ...node.theme };
  if (resolveDesignValue(document, node.enabled, theme) === false) return null;
  const style = designNodeStyle(document, node, theme, parent);
  if (node.type === "text")
    return (
      <div data-design-node={path} style={style}>
        {node.content}
      </div>
    );
  if (node.type === "icon") {
    const Icon = resolveIconComponent(String(resolveDesignValue(document, node.icon, theme)));
    if (!Icon) throw new Error(`Missing design icon ${node.icon}`);
    return (
      <Icon
        data-design-node={path}
        style={style}
        width={style.width ?? 24}
        height={style.height ?? 24}
        strokeWidth={Number(node.strokeWidth ?? 2)}
        aria-hidden
      />
    );
  }
  if (node.type === "path") {
    const viewBox = (node.viewBox as number[] | undefined) ?? [0, 0, Number(node.width), Number(node.height)];
    return (
      <svg
        data-design-node={path}
        style={{ ...style, background: undefined }}
        viewBox={viewBox.join(" ")}
        preserveAspectRatio="none"
        role="img"
        aria-label={node.name ?? "Design path"}
      >
        <path d={String(node.geometry)} fill={String(resolveDesignValue(document, node.fill, theme) ?? "none")} />
      </svg>
    );
  }
  if (node.type === "ellipse" && (node.innerRadius || node.sweepAngle)) {
    return <DesignEllipse {...props} theme={theme} />;
  }
  return (
    <div data-design-node={path} data-design-name={node.name} style={style}>
      {node.children?.map((child) => (
        <DesignElement
          key={child.id}
          document={document}
          node={child}
          parent={node}
          theme={theme}
          path={`${path}/${child.id}`}
        />
      ))}
    </div>
  );
};
const DesignEllipse = (props: NodeProps) => {
  const { node, document, theme, parent, path } = props;
  const style = designNodeStyle(document, node, theme, parent);
  const sweep = Number(resolveDesignValue(document, node.sweepAngle, theme) ?? 360);
  const start = Number(node.startAngle ?? 0);
  const inner = Number(node.innerRadius ?? 0);
  const point = (angle: number, radius: number) =>
    `${50 + Math.cos((angle * Math.PI) / 180) * radius},${50 - Math.sin((angle * Math.PI) / 180) * radius}`;
  const end = start + (Math.abs(sweep) >= 360 ? 359.999 : sweep);
  const arc = `M${point(start, 50)} A50,50 0 ${Math.abs(sweep) > 180 ? 1 : 0} ${sweep < 0 ? 1 : 0} ${point(end, 50)} L${point(end, inner * 50)} A${inner * 50},${inner * 50} 0 ${Math.abs(sweep) > 180 ? 1 : 0} ${sweep < 0 ? 0 : 1} ${point(start, inner * 50)} Z`;
  const { background: _background, borderWidth: _borderWidth, borderStyle: _borderStyle, ...shapeStyle } = style;
  return (
    <svg
      data-design-node={path}
      style={shapeStyle}
      viewBox="0 0 100 100"
      role="img"
      aria-label={node.name ?? "Design ellipse"}
    >
      <path d={arc} fill={String(resolveDesignValue(document, node.fill, theme) ?? "none")} />
    </svg>
  );
};

export const PencilDesign = (props: { document: DesignDocument; rootId: string }) => {
  const { document, rootId } = props;
  const root = expandDesign(document, rootId);
  return (
    <>
      <style>{document.fonts}</style>
      <DesignElement document={document} node={root} theme={defaultDesignTheme(document)} path={rootId} />
    </>
  );
};
