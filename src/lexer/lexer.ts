import { OPERATORS, KEYWORDS, Token, TokenInteger, TokenKeyword, TokenOp, TokenSymbol, Position, extendPosition, TokenEof } from "./token.ts";
import { Stream } from "../stream/stream.ts";

const DIGITS = "0123456789";
const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export class Lexer implements Stream<Token> {

    public unpushed: Token[];

    private idx: number = 0;
    private lineIdx: number = 0;
    private line: number = 1;

    constructor(public input: string, public source: string) {
        this.unpushed = [];
    }

    calc: Token | undefined;
    eof: boolean = false;

    hasNext() {
        if(this.eof) return false;
        if(this.calc) return true;
        this.calc = this.next();
        return this.calc != undefined;
    }
    
    next() {
        if(this.eof) return;
        if(this.calc) {
            const c = this.calc;
            this.calc = undefined;
            return c;
        }
        if(!this.hasInput()) {
            this.eof = true;
            return {
                type: "eof",
                position: this.createPosition()
            } as TokenEof;
        }
        let i = 0;
        while("\r\n\t ".includes(this.input[i])) {
            this.idx++;
            this.lineIdx++;
            if(this.input[i] == "\n") {
                this.line++;
                this.lineIdx = 0;
            }
            i++;
        }
        this.input = this.input.substring(i);
        for(const op of OPERATORS) {
            if(this.input.startsWith(op)) {
                let position: Position = this.createPosition();
                let len = this.input.length;
                this.input = this.input.substring(op.length);
                position.toIdx += len - this.input.length - 1;
                position.toLineIdx += len - this.input.length - 1;
                this.idx += len - this.input.length;
                this.lineIdx += len - this.input.length;
                return {
                    type: op,
                    position
                };
            }
        }
        let parse: Token | null = null;
        if(parse = this.parseNumber()) {
            return parse;
        } else if(parse = this.parseSymbol()) {
            return parse;
        }

        this.eof = true;
        
        throw new Error(`Invalid token: '${this.input.length > 10 ? this.input.substring(0, 10) : this.input}'${this.input.length <= 10 ? "" : "..."}`);
    }

    private advance(regex: RegExp) {
        let len = this.input.length;
        this.input = this.input.replace(regex, '');
        this.lineIdx += this.input.length - len;
        this.idx += this.input.length - len;
    }

    private createPosition(): Position {
        return {
            source: this.source,
            fromIdx: this.idx,
            toIdx: this.idx,
            fromLine: this.line,
            toLine: this.line,
            fromLineIdx: this.lineIdx,
            toLineIdx: this.lineIdx
        };
    }

    private parseSymbol(): TokenSymbol | TokenKeyword | null {
        if(this.input.length == 0 || !LETTERS.includes(this.input[0])) {
            return null;
        }
        let position: Position = this.createPosition();
        let i = 0;
        while(i < this.input.length && (this.input[i] == '_' || LETTERS.includes(this.input[i]) || DIGITS.includes(this.input[i]))) i++;
        position.toIdx += (i - 1);
        position.toLineIdx += (i - 1);
        const name = this.input.substring(0, i);
        this.input = this.input.substring(i);
        this.idx += i;
        this.lineIdx += i;
        if(KEYWORDS.includes(name as any)) {
            return {
                type: "keyword",
                keyword: name as any,
                position
            };
        }
        return {
            type: "symbol",
            name,
            position
        };
    }

    private parseNumber(): TokenInteger | null {
        let hex: boolean = false;
        let oct: boolean = false;
        let bin: boolean = false;
        let position: Position = this.createPosition();
        if(/^(h|(0x))[0-9]+/i.test(this.input)) {
            this.advance(/^(h|(0x))/i);
            hex = true;
        } else if(/^(b|(0b))[0-9]+/i.test(this.input)) {
            this.advance(/^(b|(0b))/ig);
            bin = true;
        } else if(/^(o|(0o))[0-9]+/i.test(this.input)) {
            this.advance(/^(o|(0o))/ig);
            oct = true;
        }
        position = extendPosition(position, this.createPosition());
        if(!DIGITS.includes(this.input[0])) return null;
        let i = 0;
        while(i < this.input.length && DIGITS.includes(this.input[i])) i++;
        const v = this.input.substring(0, i);
        try {
            const value = BigInt((hex ? "0x" : (oct ? "0o" : (bin ? "0b" : ""))) + v);
            this.input = this.input.substring(i);
            position.toIdx += (i - 1);
            position.toLineIdx += (i - 1);
            return {
                type: "integer",
                value,
                position
            };
        } catch(err) {
            console.error(`Failed to parse number: hex=${hex} oct=${oct} bin=${bin} ${v}`);
            return null;
        }
    }

    private hasInput(): boolean {
        return this.input.length > 0;
    }
}