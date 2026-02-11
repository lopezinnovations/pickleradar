import type { BlockMeta, BlockType } from '../types';
/**
 * Patterns for detecting COMPLETE block starts (at beginning of line)
 * These require the full marker + space/content to match
 */
export declare const BLOCK_PATTERNS: {
    readonly heading: RegExp;
    readonly codeBlockStart: RegExp;
    readonly unorderedList: RegExp;
    readonly orderedList: RegExp;
    readonly blockquote: RegExp;
    readonly horizontalRule: RegExp;
    readonly tableSeparator: RegExp;
    readonly blockImage: RegExp;
    readonly footnoteDef: RegExp;
    readonly component: RegExp;
};
/**
 * Patterns for detecting PARTIAL/INCOMPLETE block starts
 * These match as soon as the marker begins (before space/content)
 */
export declare const PARTIAL_BLOCK_PATTERNS: {
    readonly heading: RegExp;
    readonly headingWithSpace: RegExp;
    readonly codeBlockStart: RegExp;
    readonly blockquote: RegExp;
    readonly unorderedList: RegExp;
    readonly orderedList: RegExp;
    readonly horizontalRule: RegExp;
    readonly component: RegExp;
    readonly image: RegExp;
};
/**
 * Detect block type from a COMPLETE line (requires full marker + content)
 * Used for finalization decisions
 */
export declare function detectBlockType(line: string): {
    type: BlockType;
    meta: Partial<BlockMeta>;
} | null;
/**
 * Detect block type from PARTIAL/INCOMPLETE content (character-level detection)
 * Used for real-time type updates during streaming
 *
 * This allows us to show "heading" as soon as user types "#" or "## "
 */
export declare function detectPartialBlockType(content: string): {
    type: BlockType;
    meta: Partial<BlockMeta>;
    confidence: 'definite' | 'likely' | 'possible';
} | null;
//# sourceMappingURL=blockPatterns.d.ts.map