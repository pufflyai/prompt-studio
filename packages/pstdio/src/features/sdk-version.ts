import sdkPackageData from "@pstdio/sdk/package.json";

export const SDK_VERSION = typeof sdkPackageData.version === "string" ? sdkPackageData.version : "0.0.0-unknown";
