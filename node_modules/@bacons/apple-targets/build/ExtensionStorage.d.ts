export declare class ExtensionStorage {
    private readonly appGroup;
    static reloadWidget(name?: string): void;
    static reloadControls(name?: string): void;
    constructor(appGroup: string);
    set(key: string, value?: string | number | Record<string, string | number> | Array<Record<string, string | number>>): void;
    get(key: string): string | null;
    remove(key: string): void;
}
