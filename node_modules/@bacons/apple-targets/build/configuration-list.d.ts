import { XCConfigurationList, XcodeProject } from "@bacons/xcode";
import { ExtensionType } from "./target";
export type XcodeSettings = {
    name: string;
    /** Optional custom value for CFBundleDisplayName */
    displayName?: string;
    /** Name used for internal purposes. This has more strict rules and should be generated. */
    productName: string;
    /** Directory relative to the project root, (i.e. outside of the `ios` directory) where the widget code should live. */
    cwd: string;
    bundleId: string;
    deploymentTarget: string;
    currentProjectVersion: number;
    frameworks: string[];
    type: ExtensionType;
    hasAccentColor?: boolean;
    colors?: Record<string, any>;
    teamId?: string;
    icon?: string;
    exportJs?: boolean;
    /** File path to the extension config file. */
    configPath: string;
    orientation?: "default" | "portrait" | "landscape";
    deviceFamilies?: DeviceFamily[];
};
export type DeviceFamily = "phone" | "tablet";
export declare function createConfigurationListForType(project: XcodeProject, props: XcodeSettings): XCConfigurationList;
