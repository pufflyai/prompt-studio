import type { MarmaladeLayer } from "./marmalade.types";
import { defaultAdjustments } from "./marmalade-layers";
import { greatWaveImage } from "./marmalade-preview";

export const MarmaladeArtwork = (props: { layer: MarmaladeLayer }) => {
  const { layer } = props;
  if (layer.kind === "image") {
    const adjustment = { ...defaultAdjustments, ...layer.adjustments };
    const contrast = adjustment.contrast / 100;
    const brightness = adjustment.brightness / 100;
    const active = Object.entries(defaultAdjustments).some(
      ([key, value]) => adjustment[key as keyof typeof adjustment] !== value,
    );
    const filterId = `adjust-${layer.id}`;
    return (
      <>
        <defs>
          {active ? (
            <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="linear" slope={contrast} intercept={0.5 - contrast * 0.5} />
                <feFuncG type="linear" slope={contrast} intercept={0.5 - contrast * 0.5} />
                <feFuncB type="linear" slope={contrast} intercept={0.5 - contrast * 0.5} />
              </feComponentTransfer>
              <feComponentTransfer>
                <feFuncR type="linear" slope={brightness} />
                <feFuncG type="linear" slope={brightness} />
                <feFuncB type="linear" slope={brightness} />
              </feComponentTransfer>
              <feColorMatrix type="saturate" values={String(adjustment.saturation / 100)} />
              <feGaussianBlur stdDeviation={adjustment.blur} />
            </filter>
          ) : null}
        </defs>
        <image
          href={greatWaveImage}
          width={layer.width}
          height={layer.height}
          preserveAspectRatio="none"
          filter={active ? `url(#${filterId})` : undefined}
        />
      </>
    );
  }
  if (layer.kind === "shape") {
    if (layer.shape === "ellipse")
      return (
        <ellipse
          cx={layer.width / 2}
          cy={layer.height / 2}
          rx={layer.width / 2}
          ry={layer.height / 2}
          fill={layer.color ?? "#10263b"}
        />
      );
    return <rect width={layer.width} height={layer.height} rx={12} fill={layer.color ?? "#10263b"} />;
  }
  if (layer.kind === "brush")
    return (
      <polyline
        points={layer.points?.map((point) => point.join(",")).join(" ")}
        fill="none"
        stroke={layer.color ?? "#f4b860"}
        strokeWidth={layer.strokeWidth ?? 8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  if (layer.kind === "text") {
    const alignment = layer.align ?? "left";
    const x = { left: 0, center: layer.width / 2, right: layer.width }[alignment];
    const anchor = ({ left: "start", center: "middle", right: "end" } as const)[alignment];
    return (
      <text
        x={x}
        y={layer.fontSize ?? layer.height * 0.8}
        fontFamily={layer.fontFamily ?? "sans-serif"}
        fontWeight={layer.fontWeight ?? "400"}
        textAnchor={anchor}
        style={{ fontSize: layer.fontSize ?? layer.height * 0.8 }}
        fill={layer.color ?? "#ffffff"}
      >
        {layer.text}
      </text>
    );
  }
  return null;
};
