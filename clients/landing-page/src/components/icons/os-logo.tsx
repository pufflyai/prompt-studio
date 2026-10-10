import { AppleLogo, type IconProps, LinuxLogo, WindowsLogo } from "@phosphor-icons/react";
import { Monitor } from "lucide-react";
import type { ElementType } from "react";

const MacOSLogo = (props: IconProps) => (
  <AppleLogo {...props} weight="fill" data-os-logo="macOS" aria-hidden="true" focusable="false" />
);
const WindowsOSLogo = (props: IconProps) => (
  <WindowsLogo {...props} weight="fill" data-os-logo="Windows" aria-hidden="true" focusable="false" />
);
const LinuxOSLogo = (props: IconProps) => (
  <LinuxLogo {...props} weight="fill" data-os-logo="Linux" aria-hidden="true" focusable="false" />
);

const PLATFORM_LOGOS: Record<string, ElementType> = { macOS: MacOSLogo, Windows: WindowsOSLogo, Linux: LinuxOSLogo };

export const platformIcon = (platform: string) => PLATFORM_LOGOS[platform] ?? Monitor;

export const OSLogo = (props: { platform: string; size?: number }) => {
  const Logo = platformIcon(props.platform);
  return <Logo size={props.size} />;
};
