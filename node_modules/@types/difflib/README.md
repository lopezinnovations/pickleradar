# Installation
> `npm install --save @types/difflib`

# Summary
This package contains type definitions for difflib (https://github.com/qiao/difflib.js).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/difflib.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/difflib/index.d.ts)
````ts
export class SequenceMatcher<T> {
    constructor(isjunk: ((char: string) => boolean) | null, left: T, right: T, autojunk?: boolean);
    setSeqs(left: T, right: T): ((char: string) => boolean) | undefined;
    setSeq1(left: T): null | undefined;
    setSeq2(right: T): ((char: string) => boolean) | undefined;
    findLongestMatch(
        leftIndexStart: number,
        leftIndexEnd: number,
        rightIndexStart: number,
        rightIndexEnd: number,
    ): [number, number, number];
    getMatchingBlocks(): Array<[number, number, number]>;
    getOpcodes(): Array<["replace" | "delete" | "insert" | "equal", number, number, number, number]>;
    ratio(): number;
    quickRatio(): number;
    realQuickRatio(): number;
}

export class Differ {
    constructor(linejunk?: (s: string) => boolean, charjunk?: (s: string) => boolean);
    compare(a: readonly string[], b: readonly string[]): string[];
}

export function unifiedDiff(
    from: readonly string[],
    to: readonly string[],
    args: {
        fromfile?: string;
        tofile?: string;
        fromfiledate?: string;
        tofiledate?: string;
        lineterm?: string;
    },
): string[];

export function contextDiff(
    from: readonly string[],
    to: readonly string[],
    args: {
        fromfile?: string;
        tofile?: string;
        fromfiledate?: string;
        tofiledate?: string;
        lineterm?: string;
    },
): string[];

export function ndiff(
    from: readonly string[],
    to: readonly string[],
    linejunk?: (s: string) => boolean,
    charjunk?: (s: string) => boolean,
): string[];

export function restore(delta: string[], which: 1 | 2): string[];

export function getCloseMatches(word: string, possibilities: string[], n?: number, cutoff?: number): string[];

````

### Additional Details
 * Last updated: Wed, 24 Jan 2024 14:36:12 GMT
 * Dependencies: none

# Credits
These definitions were written by [majames](https://github.com/majames), [Hugues Le Gendre](https://github.com/hlegendre), and [Antonio Min](https://github.com/antoniomin).
