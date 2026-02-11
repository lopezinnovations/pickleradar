/**
 * Markdown Parser
 *
 * Wrapper around remark + remark-gfm for robust markdown parsing.
 * Caches the processor instance for performance.
 *
 * NOTE: We disable setext-style headings (Text\n---) and only support
 * ATX-style headings (# Heading) for predictable streaming behavior.
 */
import type { Root, Content } from 'mdast';
/**
 * Escape potential setext underlines before parsing.
 *
 * Setext headings use underlines (--- or ===) on the line after text:
 *   Heading
 *   -------
 *
 * We only support ATX-style headings (# Heading) because:
 * 1. They're unambiguous during streaming
 * 2. They don't conflict with list markers or horizontal rules
 *
 * This function adds a zero-width space to break the setext pattern.
 * The zero-width space is invisible in rendered output.
 *
 * Preserves:
 * - Unindented single list markers (-, *, +) — these start new list items
 * - Horizontal rules (--- after blank line)
 *
 * Escapes:
 * - Indented dashes/equals (could be setext underlines)
 * - Multiple dashes/equals (could be setext underlines)
 *
 * @param markdown - Raw markdown string
 * @returns Markdown with setext underlines escaped
 */
export declare function escapeSetextUnderlines(markdown: string): string;
/**
 * Parse complete markdown document into MDAST Root
 *
 * @param markdown - Markdown content to parse
 * @returns MDAST root node
 */
export declare function parseMarkdown(markdown: string): Root;
/**
 * Parse a single block of markdown and return the first block-level node.
 * Useful for parsing individual blocks in isolation.
 *
 * @param content - Block content to parse
 * @returns First MDAST block node, or null if empty/invalid
 */
export declare function parseBlockContent(content: string): Content | null;
/**
 * Parse markdown and return all block nodes (excluding root)
 *
 * @param markdown - Markdown content to parse
 * @returns Array of MDAST block nodes
 */
export declare function parseBlocks(markdown: string): Content[];
/**
 * Check if remark would parse this as valid formatting
 * Useful for testing/validation
 *
 * @param markdown - Markdown to validate
 * @returns True if parses without errors
 */
export declare function isValidMarkdown(markdown: string): boolean;
//# sourceMappingURL=parser.d.ts.map