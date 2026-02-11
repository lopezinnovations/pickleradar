/**
 * Theme Configurations for Streamdown-RN
 *
 * Dark and light themes with consistent styling.
 * Optimized for readability and streaming performance.
 *
 * Font-agnostic: Uses platform defaults for text, allowing host apps
 * to set their own fonts. Only monospace is specified for code blocks.
 */
import type { ThemeConfig } from '../core/types';
export declare const darkTheme: ThemeConfig;
export declare const lightTheme: ThemeConfig;
/**
 * Get theme by name or return custom theme
 */
export declare function getTheme(theme: 'dark' | 'light' | ThemeConfig): ThemeConfig;
/**
 * Generate text styles for a theme
 *
 * Font-agnostic: Only applies fontFamily when explicitly set in theme.
 * This allows host apps to set fonts at the root level and have them inherited.
 */
export declare function getTextStyles(theme: ThemeConfig): {
    body: {
        fontSize: number;
        lineHeight: number;
        fontFamily: string;
        color: string;
    } | {
        fontSize: number;
        lineHeight: number;
        fontFamily?: undefined;
        color: string;
    };
    heading1: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "bold";
        marginBottom: number;
        fontFamily: string;
        color: string;
    } | {
        fontSize: number;
        lineHeight: number;
        fontWeight: "bold";
        marginBottom: number;
        fontFamily?: undefined;
        color: string;
    };
    heading2: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "bold";
        marginBottom: number;
        fontFamily: string;
        color: string;
    } | {
        fontSize: number;
        lineHeight: number;
        fontWeight: "bold";
        marginBottom: number;
        fontFamily?: undefined;
        color: string;
    };
    heading3: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "bold";
        marginBottom: number;
        fontFamily: string;
        color: string;
    } | {
        fontSize: number;
        lineHeight: number;
        fontWeight: "bold";
        marginBottom: number;
        fontFamily?: undefined;
        color: string;
    };
    heading4: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "bold";
        marginBottom: number;
        fontFamily: string;
        color: string;
    } | {
        fontSize: number;
        lineHeight: number;
        fontWeight: "bold";
        marginBottom: number;
        fontFamily?: undefined;
        color: string;
    };
    heading5: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "bold";
        marginBottom: number;
        fontFamily: string;
        color: string;
    } | {
        fontSize: number;
        lineHeight: number;
        fontWeight: "bold";
        marginBottom: number;
        fontFamily?: undefined;
        color: string;
    };
    heading6: {
        fontSize: number;
        lineHeight: number;
        fontWeight: "bold";
        marginBottom: number;
        fontFamily: string;
        color: string;
    } | {
        fontSize: number;
        lineHeight: number;
        fontWeight: "bold";
        marginBottom: number;
        fontFamily?: undefined;
        color: string;
    };
    paragraph: {
        fontSize: number;
        lineHeight: number;
        marginBottom: number;
        fontFamily: string;
        color: string;
    } | {
        fontSize: number;
        lineHeight: number;
        marginBottom: number;
        fontFamily?: undefined;
        color: string;
    };
    bold: {
        fontWeight: "bold";
        fontFamily: string;
    } | {
        fontWeight: "bold";
        fontFamily?: undefined;
    };
    italic: {
        fontStyle: "italic";
    };
    code: {
        fontSize: number;
        color: string;
        backgroundColor: string;
        paddingHorizontal: number;
        paddingVertical: number;
        borderRadius: number;
        fontFamily: string;
    } | {
        fontSize: number;
        color: string;
        backgroundColor: string;
        paddingHorizontal: number;
        paddingVertical: number;
        borderRadius: number;
        fontFamily?: undefined;
    };
    link: {
        color: string;
        textDecorationLine: "underline";
    };
    strikethrough: {
        textDecorationLine: "line-through";
    };
};
/**
 * Generate block container styles for a theme
 */
export declare function getBlockStyles(theme: ThemeConfig): {
    codeBlock: {
        backgroundColor: string;
        borderRadius: number;
        padding: number;
        marginBottom: number;
        borderWidth: number;
        borderColor: string;
    };
    blockquote: {
        borderLeftWidth: number;
        borderLeftColor: string;
        paddingLeft: number;
        marginBottom: number;
    };
    list: {
        marginBottom: number;
    };
    listItem: {
        paddingLeft: number;
        marginBottom: number;
    };
    horizontalRule: {
        height: number;
        backgroundColor: string;
        marginVertical: number;
    };
    table: {
        marginBottom: number;
        borderWidth: number;
        borderColor: string;
        borderRadius: number;
        overflow: "hidden";
    };
    tableHeader: {
        backgroundColor: string;
        padding: number;
        borderBottomWidth: number;
        borderBottomColor: string;
    };
    tableCell: {
        padding: number;
        borderBottomWidth: number;
        borderBottomColor: string;
    };
};
//# sourceMappingURL=index.d.ts.map