import { Monitor } from "lucide-react";
import { PLATFORMS } from "../benchmarks/platforms";
import { SelectMenu } from "./select-menu";

interface PlatformControlProps {
  value: string;
  onValueChange: (platform: string) => void;
}

export const PlatformControl = (props: PlatformControlProps) => {
  const { value, onValueChange } = props;
  return (
    <SelectMenu
      label="Platform"
      icon={<Monitor />}
      value={value}
      options={PLATFORMS.map((platform) => ({ value: platform.id, label: platform.label }))}
      onValueChange={onValueChange}
    />
  );
};
