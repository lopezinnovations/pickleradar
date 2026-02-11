"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeNameForNonDisplayUse = exports.getSanitizedBundleIdentifier = exports.LOG_QUEUE = exports.createLogQueue = exports.logOnce = exports.warnOnce = void 0;
function memoize(fn) {
    const cache = new Map();
    return ((...args) => {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = fn(...args);
        cache.set(key, result);
        return result;
    });
}
exports.warnOnce = memoize(console.warn);
exports.logOnce = memoize(console.log);
function createLogQueue() {
    const queue = [];
    const flush = () => {
        queue.forEach((fn) => fn());
        queue.length = 0;
    };
    return {
        flush,
        add: (fn) => {
            queue.push(fn);
        },
    };
}
exports.createLogQueue = createLogQueue;
// Queue up logs so they only run when prebuild is actually running and not during standard config reads.
exports.LOG_QUEUE = createLogQueue();
function getSanitizedBundleIdentifier(value) {
    // According to the behavior observed when using the UI in Xcode.
    // Must start with a letter, period, or hyphen (not number).
    // Can only contain alphanumeric characters, periods, and hyphens.
    // Can have empty segments (e.g. com.example..app).
    return value.replace(/(^[^a-zA-Z.-]|[^a-zA-Z0-9-.])/g, "-");
}
exports.getSanitizedBundleIdentifier = getSanitizedBundleIdentifier;
function sanitizeNameForNonDisplayUse(name) {
    return name
        .replace(/[\W_]+/g, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}
exports.sanitizeNameForNonDisplayUse = sanitizeNameForNonDisplayUse;
