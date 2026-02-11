"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_plugins_1 = require("@expo/config-plugins");
const plist_1 = __importDefault(require("@expo/plist"));
const fs_1 = __importDefault(require("fs"));
const glob_1 = require("glob");
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const with_ios_colorset_1 = require("./colorset/with-ios-colorset");
const with_image_asset_1 = require("./icon/with-image-asset");
const with_ios_icon_1 = require("./icon/with-ios-icon");
const target_1 = require("./target");
const with_eas_credentials_1 = require("./with-eas-credentials");
const with_xcode_changes_1 = require("./with-xcode-changes");
const util_1 = require("./util");
const DEFAULT_DEPLOYMENT_TARGET = "18.0";
const withWidget = (config, props) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    util_1.LOG_QUEUE.add(() => (0, util_1.warnOnce)((0, chalk_1.default) `\nUsing experimental Config Plugin {bold @bacons/apple-targets} that is subject to breaking changes.`));
    // TODO: Magically based on the top-level folders in the `ios-widgets/` folder
    if (props.icon && !/https?:\/\//.test(props.icon)) {
        props.icon = path_1.default.join(props.directory, props.icon);
    }
    // This value should be used for the target name and other internal uses.
    const targetDirName = path_1.default.basename(path_1.default.dirname(props.configPath));
    // Sanitized for general usage. This name just needs to resemble the input value since it shouldn't be used for user-facing values such as the home screen or app store.
    const productName = (0, util_1.sanitizeNameForNonDisplayUse)(props.name || targetDirName) ||
        (0, util_1.sanitizeNameForNonDisplayUse)(targetDirName) ||
        (0, util_1.sanitizeNameForNonDisplayUse)(props.type);
    // This should never happen.
    if (!productName) {
        throw new Error(`[bacons/apple-targets][${props.type}] Target name does not contain any valid characters: ${targetDirName}`);
    }
    // TODO: Are there characters that aren't allowed in `CFBundleDisplayName`?
    const targetDisplayName = (_a = props.name) !== null && _a !== void 0 ? _a : productName;
    const targetDirAbsolutePath = path_1.default.join((_c = (_b = config._internal) === null || _b === void 0 ? void 0 : _b.projectRoot) !== null && _c !== void 0 ? _c : "", props.directory);
    const entitlementsFiles = (0, glob_1.globSync)("*.entitlements", {
        absolute: true,
        cwd: targetDirAbsolutePath,
    });
    if (entitlementsFiles.length > 1) {
        throw new Error(`[bacons/apple-targets][${props.type}] Found more than one '*.entitlements' file in ${targetDirAbsolutePath}`);
    }
    let entitlementsJson = props.entitlements;
    if (entitlementsJson) {
        // Apply default entitlements that must be present for a target to work.
        const applyDefaultEntitlements = (entitlements) => {
            var _a, _b, _c, _d, _e, _f;
            if (props.type === "clip") {
                entitlements["com.apple.developer.parent-application-identifiers"] = [
                    `$(AppIdentifierPrefix)${config.ios.bundleIdentifier}`,
                ];
                // Try to extract the linked website from the original associated domains:
                const associatedDomainsKey = "com.apple.developer.associated-domains";
                // If the target doesn't explicitly define associated domains, then try to use the main app's associated domains.
                if (!entitlements[associatedDomainsKey]) {
                    const associatedDomains = (_b = (_a = config.ios) === null || _a === void 0 ? void 0 : _a.associatedDomains) !== null && _b !== void 0 ? _b : (_d = (_c = config.ios) === null || _c === void 0 ? void 0 : _c.entitlements) === null || _d === void 0 ? void 0 : _d["com.apple.developer.associated-domains"];
                    if (!associatedDomains ||
                        !Array.isArray(associatedDomains) ||
                        associatedDomains.length === 0) {
                        (0, util_1.warnOnce)((0, chalk_1.default) `{yellow [${targetDirName}]} Apple App Clip may require the associated domains entitlement but none were found in the Expo config.\nExample:\n${JSON.stringify({
                            ios: {
                                associatedDomains: [`applinks:placeholder.expo.app`],
                            },
                        }, null, 2)}`);
                    }
                    else {
                        // Associated domains are found:
                        // "applinks:pillarvalley.expo.app",
                        // "webcredentials:pillarvalley.expo.app",
                        // "activitycontinuation:pillarvalley.expo.app"
                        const sanitizedUrls = associatedDomains
                            .map((url) => {
                            return (url
                                .replace(/^(appclips|applinks|webcredentials|activitycontinuation):/, "")
                                // Remove trailing slashes
                                .replace(/\/$/, "")
                                // Remove http/https
                                .replace(/^https?:\/\//, ""));
                        })
                            .filter(Boolean);
                        const unique = [...new Set(sanitizedUrls)];
                        if (unique.length) {
                            (0, util_1.warnOnce)((0, chalk_1.default) `{gray [${targetDirName}]} Apple App Clip expo-target.config.js missing associated domains entitlements in the target config. Using the following defaults:\n${JSON.stringify({
                                entitlements: {
                                    [associatedDomainsKey]: [
                                        `appclips:${unique[0] || "mywebsite.expo.app"}`,
                                    ],
                                },
                            }, null, 2)}`);
                            // Add anyways
                            entitlements[associatedDomainsKey] = unique.map((url) => `appclips:${url}`);
                        }
                    }
                }
                // NOTE: This doesn't seem to be required anymore (Oct 12 2024):
                // entitlements["com.apple.developer.on-demand-install-capable"] = true;
            }
            const APP_GROUP_KEY = "com.apple.security.application-groups";
            const hasDefinedAppGroupsManually = APP_GROUP_KEY in entitlements;
            if (
            // If the user hasn't manually defined the app groups array.
            !hasDefinedAppGroupsManually &&
                // And the target is part of a predefined list of types that benefit from app groups that match the main app...
                target_1.SHOULD_USE_APP_GROUPS_BY_DEFAULT[props.type]) {
                const mainAppGroups = (_f = (_e = config.ios) === null || _e === void 0 ? void 0 : _e.entitlements) === null || _f === void 0 ? void 0 : _f[APP_GROUP_KEY];
                if (Array.isArray(mainAppGroups) && mainAppGroups.length > 0) {
                    // Then set the target app groups to match the main app.
                    entitlements[APP_GROUP_KEY] = mainAppGroups;
                    util_1.LOG_QUEUE.add(() => {
                        (0, util_1.logOnce)((0, chalk_1.default) `[${targetDirName}] Syncing app groups with main app. {dim Define entitlements[${JSON.stringify(APP_GROUP_KEY)}] in the {bold expo-target.config} file to override.}`);
                    });
                }
                else {
                    util_1.LOG_QUEUE.add(() => {
                        var _a, _b;
                        return (0, util_1.warnOnce)((0, chalk_1.default) `{yellow [${targetDirName}]} Apple target may require the App Groups entitlement but none were found in the Expo config.\nExample:\n${JSON.stringify({
                            ios: {
                                entitlements: {
                                    [APP_GROUP_KEY]: [
                                        `group.${(_b = (_a = config.ios) === null || _a === void 0 ? void 0 : _a.bundleIdentifier) !== null && _b !== void 0 ? _b : `com.example.${config.slug}`}`,
                                    ],
                                },
                            },
                        }, null, 2)}`);
                    });
                }
            }
            return entitlements;
        };
        entitlementsJson = applyDefaultEntitlements(entitlementsJson);
    }
    // If the user defined entitlements, then overwrite any existing entitlements file
    if (entitlementsJson) {
        (0, config_plugins_1.withDangerousMod)(config, [
            "ios",
            async (config) => {
                var _a;
                const GENERATED_ENTITLEMENTS_FILE_NAME = "generated.entitlements";
                const entitlementsFilePath = (_a = entitlementsFiles[0]) !== null && _a !== void 0 ? _a : 
                // Use the name `generated` to help indicate that this file should be in sync with the config
                path_1.default.join(targetDirAbsolutePath, GENERATED_ENTITLEMENTS_FILE_NAME);
                if (entitlementsFiles[0]) {
                    const relativeName = path_1.default.relative(targetDirAbsolutePath, entitlementsFiles[0]);
                    if (relativeName !== GENERATED_ENTITLEMENTS_FILE_NAME) {
                        console.log(`[${targetDirName}] Replacing ${path_1.default.relative(targetDirAbsolutePath, entitlementsFiles[0])} with entitlements JSON from config`);
                    }
                }
                fs_1.default.writeFileSync(entitlementsFilePath, plist_1.default.build(entitlementsJson));
                return config;
            },
        ]);
    }
    else {
        entitlementsJson = entitlementsFiles[0]
            ? plist_1.default.parse(fs_1.default.readFileSync(entitlementsFiles[0], "utf8"))
            : undefined;
    }
    // Ensure the entry file exists
    (0, config_plugins_1.withDangerousMod)(config, [
        "ios",
        async (config) => {
            util_1.LOG_QUEUE.flush();
            fs_1.default.mkdirSync(targetDirAbsolutePath, { recursive: true });
            const files = [
                ["Info.plist", plist_1.default.build((0, target_1.getTargetInfoPlistForType)(props.type))],
            ];
            // if (props.type === "widget") {
            //   files.push(
            //     [
            //       "index.swift",
            //       ENTRY_FILE.replace(
            //         "// Export widgets here",
            //         "// Export widgets here\n" + `        ${widget}()`
            //       ),
            //     ],
            //     [widget + ".swift", WIDGET.replace(/alpha/g, widget)],
            //     [widget + ".intentdefinition", INTENT_DEFINITION]
            //   );
            // }
            files.forEach(([filename, content]) => {
                const filePath = path_1.default.join(targetDirAbsolutePath, filename);
                if (!fs_1.default.existsSync(filePath)) {
                    fs_1.default.writeFileSync(filePath, content);
                }
            });
            return config;
        },
    ]);
    const mainAppBundleId = config.ios.bundleIdentifier;
    const bundleId = (() => {
        var _a;
        // Support the bundle identifier being appended to the main app's bundle identifier.
        if ((_a = props.bundleIdentifier) === null || _a === void 0 ? void 0 : _a.startsWith(".")) {
            return mainAppBundleId + props.bundleIdentifier;
        }
        else if (props.bundleIdentifier) {
            return props.bundleIdentifier;
        }
        if (props.type === "clip") {
            // Use a more standardized bundle identifier for App Clips.
            return mainAppBundleId + ".clip";
        }
        let bundleId = mainAppBundleId;
        bundleId += ".";
        // Generate the bundle identifier. This logic needs to remain generally stable since it's used for a permanent value.
        // Key here is simplicity and predictability since it's already appended to the main app's bundle identifier.
        return mainAppBundleId + "." + (0, util_1.getSanitizedBundleIdentifier)(props.type);
    })();
    const deviceFamilies = ((_d = config.ios) === null || _d === void 0 ? void 0 : _d.isTabletOnly)
        ? ["tablet"]
        : ((_e = config.ios) === null || _e === void 0 ? void 0 : _e.supportsTablet)
            ? ["phone", "tablet"]
            : ["phone"];
    (0, with_xcode_changes_1.withXcodeChanges)(config, {
        productName,
        configPath: props.configPath,
        name: targetDisplayName,
        displayName: props.displayName,
        cwd: "../" +
            path_1.default.relative(config._internal.projectRoot, path_1.default.resolve(props.directory)),
        deploymentTarget: (_f = props.deploymentTarget) !== null && _f !== void 0 ? _f : DEFAULT_DEPLOYMENT_TARGET,
        bundleId,
        icon: props.icon,
        orientation: config.orientation,
        hasAccentColor: !!((_g = props.colors) === null || _g === void 0 ? void 0 : _g.$accent),
        deviceFamilies,
        // @ts-expect-error: who cares
        currentProjectVersion: ((_h = config.ios) === null || _h === void 0 ? void 0 : _h.buildNumber) || 1,
        frameworks: (0, target_1.getFrameworksForType)(props.type).concat(props.frameworks || []),
        type: props.type,
        teamId: props.appleTeamId,
        colors: props.colors,
        exportJs: (_j = props.exportJs) !== null && _j !== void 0 ? _j : 
        // Assume App Clips are used for React Native.
        props.type === "clip",
    });
    config = (0, with_eas_credentials_1.withEASTargets)(config, {
        targetName: productName,
        bundleIdentifier: bundleId,
        entitlements: entitlementsJson,
    });
    if (props.images) {
        Object.entries(props.images).forEach(([name, image]) => {
            (0, with_image_asset_1.withImageAsset)(config, {
                image,
                name,
                cwd: props.directory,
            });
        });
    }
    withConfigColors(config, props);
    if (props.icon) {
        (0, with_ios_icon_1.withIosIcon)(config, {
            type: props.type,
            cwd: props.directory,
            // TODO: read from the top-level icon.png file in the folder -- ERR this doesn't allow for URLs
            iconFilePath: props.icon,
            isTransparent: ["action"].includes(props.type),
        });
    }
    return config;
};
const withConfigColors = (config, props) => {
    var _a;
    props.colors = (_a = props.colors) !== null && _a !== void 0 ? _a : {};
    // const colors: NonNullable<Props["colors"]> = props.colors ?? {};
    // You use the WidgetBackground and `$accent` to style the widget configuration interface of a configurable widget. Apple could have chosen names to make that more obvious.
    // https://useyourloaf.com/blog/widget-background-and-accent-color/
    // i.e. when you press and hold on a widget to configure it, the background color of the widget configuration interface changes to the background color we set here.
    // if (props.widgetBackgroundColor)
    //   colors["$widgetBackground"] = props.widgetBackgroundColor;
    // if (props.accentColor) colors["AccentColor"] = props.accentColor;
    if (props.colors) {
        Object.entries(props.colors).forEach(([name, color]) => {
            (0, with_ios_colorset_1.withIosColorset)(config, {
                cwd: props.directory,
                name,
                color: typeof color === "string" ? color : color.light,
                darkColor: typeof color === "string" ? undefined : color.dark,
            });
        });
    }
    // TODO: Add clean-up maybe? This would possibly restrict the ability to create native colors outside of the Expo target config.
    return config;
};
exports.default = withWidget;
