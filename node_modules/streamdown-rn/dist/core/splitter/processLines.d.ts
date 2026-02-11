import type { BlockRegistry, IncompleteTagState } from '../types';
interface ProcessArgs {
    registry: BlockRegistry;
    fullText: string;
    lines: string[];
    activeContent: string;
    tagState: IncompleteTagState;
    activeStartPos: number;
}
export declare function processLines(args: ProcessArgs): BlockRegistry;
export {};
//# sourceMappingURL=processLines.d.ts.map