import type { BlockRegistry } from '../types';
/**
 * Process new content character-by-character.
 *
 * This ensures consistent block boundary detection regardless of chunk size.
 * Whether content arrives 1 character at a time or 1000 characters at once,
 * block boundaries are detected at the exact character position.
 */
export declare function processNewContent(registry: BlockRegistry, fullText: string): BlockRegistry;
export declare function resetRegistry(): BlockRegistry;
/**
 * Finalize the active block into a stable block.
 * Call this when streaming is complete to ensure the last block is properly memoized.
 */
export declare function finalizeActiveBlock(registry: BlockRegistry): BlockRegistry;
//# sourceMappingURL=index.d.ts.map