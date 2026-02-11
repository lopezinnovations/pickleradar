"use strict";

import { Appearance, Platform, TurboModuleRegistry } from "react-native";
const NativeModule = Platform.OS === "android" ? TurboModuleRegistry.getEnforcing("RNEdgeToEdge") : null;
if (NativeModule != null) {
  Appearance.addChangeListener(() => {
    NativeModule.onColorSchemeChange();
  });
}
export default NativeModule;
//# sourceMappingURL=NativeEdgeToEdgeModule.js.map