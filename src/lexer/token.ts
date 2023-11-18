export type Token = TokenEof | TokenOp | TokenInteger | TokenSymbol | TokenKeyword | TokenString;

export type keyword = "let" | "u8" | "u16" | "void" | "if" | "else" | "while" | "continue" | "break" | "asm";
export type operator = ";" | "{" | "}" | "(" | ")" | "+" | "-" | "=" | ":";

export interface Position {
    source: string;
    fromIdx: number;
    fromLine: number;
    fromLineIdx: number;
    toIdx: number;
    toLine: number;
    toLineIdx: number;
}

export function extendPosition(start: Position, end: Position): Position {
    return {
        ...start,
        toLine: end.toLine,
        toLineIdx: end.toLineIdx,
        toIdx: end.toIdx
    };
}

export interface TokenEof {
    type: "eof";
    position: Position;
}

export interface TokenString {
    type: "string";
    value: string;
    position: Position;
}

export const OPERATORS: operator[] = [
    ";", "{", "}", "(", ")", "+", "-", "=", ":"
];

export const KEYWORDS: keyword[] = [
    "let", "u8", "u16", "if", "else", "void", "while", "continue", "break", "asm"
];

export interface TokenOp {
    type: operator;
    position: Position;
}

export interface TokenSymbol {
    type: "symbol";
    name: string;
    position: Position;
}

export interface TokenKeyword {
    type: "keyword";
    keyword: keyword;
    position: Position;
}

export interface TokenInteger {
    type: "integer";
    value: bigint;
    position: Position;
}