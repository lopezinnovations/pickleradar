"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTargetsDir = void 0;
const glob_1 = require("glob");
const path_1 = __importDefault(require("path"));
const chalk_1 = __importDefault(require("chalk"));
const with_pod_target_extension_1 = require("./with-pod-target-extension");
const with_widget_1 = __importDefault(require("./with-widget"));
const with_bacons_xcode_1 = require("./with-bacons-xcode");
const util_1 = require("./util");
const withTargetsDir = (config, _props) => {
    var _a;
    let { appleTeamId = (_a = config === null || config === void 0 ? void 0 : config.ios) === null || _a === void 0 ? void 0 : _a.appleTeamId } = _props || {};
    const { root = "./targets", match = "*" } = _props || {};
    const projectRoot = config._internal.projectRoot;
    if (!appleTeamId) {
        (0, util_1.warnOnce)((0, chalk_1.default) `{yellow [bacons/apple-targets]} Expo config is missing required {cyan ios.appleTeamId} property. Find this in Xcode and add to the Expo Config to correct. iOS builds may fail until this is corrected.`);
    }
    const targets = (0, glob_1.globSync)(`${root}/${match}/expo-target.config.@(json|js)`, {
        // const targets = globSync(`./targets/action/expo-target.config.@(json|js)`, {
        cwd: projectRoot,
        absolute: true,
    });
    targets.forEach((configPath) => {
        const targetConfig = require(configPath);
        let evaluatedTargetConfigObject = targetConfig;
        // If it's a function, evaluate it
        if (typeof targetConfig === "function") {
            evaluatedTargetConfigObject = targetConfig(config);
            if (typeof evaluatedTargetConfigObject !== "object") {
                throw new Error(`Expected target config function to return an object, but got ${typeof evaluatedTargetConfigObject}`);
            }
        }
        else if (typeof targetConfig !== "object") {
            throw new Error(`Expected target config to be an object or function that returns an object, but got ${typeof targetConfig}`);
        }
        if (!evaluatedTargetConfigObject.type) {
            throw new Error(`Expected target config to have a 'type' property denoting the type of target it is, e.g. 'widget'`);
        }
        config = (0, with_widget_1.default)(config, {
            appleTeamId,
            ...evaluatedTargetConfigObject,
            directory: path_1.default.relative(projectRoot, path_1.default.dirname(configPath)),
            configPath,
        });
    });
    (0, with_pod_target_extension_1.withPodTargetExtension)(config);
    (0, with_bacons_xcode_1.withXcodeProjectBetaBaseMod)(config);
    return config;
};
exports.withTargetsDir = withTargetsDir;
module.exports = exports.withTargetsDir;
