import { SegmentedControl } from "@pstdio/ui";
import { PLATFORMS } from "../benchmarks/platforms";

interface PlatformControlProps {
  value: string;
  onValueChange: (platform: string) => void;
}

export const PlatformControl = (props: PlatformControlProps) => {
  const { value, onValueChange } = props;
  return (
    <SegmentedControl
      aria-label="Platform"
      value={value}
      onValueChange={onValueChange}
      options={PLATFORMS.map((platform) => ({ value: platform.id, label: platform.label }))}
    />
  );
};
