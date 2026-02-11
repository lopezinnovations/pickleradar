"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _reactNative = require("react-native");
const NativeModule = _reactNative.Platform.OS === "android" ? _reactNative.TurboModuleRegistry.getEnforcing("RNEdgeToEdge") : null;
if (NativeModule != null) {
  _reactNative.Appearance.addChangeListener(() => {
    NativeModule.onColorSchemeChange();
  });
}
var _default = exports.default = NativeModule;
//# sourceMappingURL=NativeEdgeToEdgeModule.js.map