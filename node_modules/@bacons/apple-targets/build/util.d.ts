export declare const warnOnce: {
    (...data: any[]): void;
    (message?: any, ...optionalParams: any[]): void;
};
export declare const logOnce: {
    (...data: any[]): void;
    (message?: any, ...optionalParams: any[]): void;
};
export declare function createLogQueue(): {
    add: (fn: Function) => void;
    flush: () => void;
};
export declare const LOG_QUEUE: {
    add: (fn: Function) => void;
    flush: () => void;
};
export declare function getSanitizedBundleIdentifier(value: string): string;
export declare function sanitizeNameForNonDisplayUse(name: string): string;
