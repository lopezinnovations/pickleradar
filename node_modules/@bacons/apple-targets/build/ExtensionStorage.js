"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtensionStorage = void 0;
// @ts-expect-error
const ExtensionStorageModule = (_a = expo === null || expo === void 0 ? void 0 : expo.modules) === null || _a === void 0 ? void 0 : _a.ExtensionStorage;
const nativeModule = ExtensionStorageModule !== null && ExtensionStorageModule !== void 0 ? ExtensionStorageModule : {
    setInt() { },
    setString() { },
    reloadWidget() { },
    reloadControls() { },
    setObject() { },
    setArray() { },
    get() { },
    remove() { },
};
const originalSetObject = nativeModule.setObject;
// Sweet API doesn't support doing this natively.
nativeModule.setObject = (key, value, suite) => {
    if (Array.isArray(value)) {
        return nativeModule.setArray(key, value, suite);
    }
    return originalSetObject(key, value, suite);
};
class ExtensionStorage {
    static reloadWidget(name) {
        nativeModule.reloadWidget(name);
    }
    static reloadControls(name) {
        nativeModule.reloadControls(name);
    }
    constructor(appGroup) {
        this.appGroup = appGroup;
    }
    set(key, value) {
        if (typeof value === "number") {
            nativeModule.setInt(key, value, this.appGroup);
        }
        else if (Array.isArray(value)) {
            nativeModule.setArray(key, value, this.appGroup);
        }
        else if (typeof value === "string") {
            nativeModule.setString(key, value, this.appGroup);
        }
        else if (value == null) {
            nativeModule.remove(key, this.appGroup);
        }
        else {
            nativeModule.setObject(key, value, this.appGroup);
        }
    }
    get(key) {
        return nativeModule.get(key, this.appGroup);
    }
    remove(key) {
        nativeModule.remove(key, this.appGroup);
    }
}
exports.ExtensionStorage = ExtensionStorage;
