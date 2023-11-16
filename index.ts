import { Lexer } from './src/lexer/lexer';
import fs from "fs";
import { Parser } from './src/parser/parser';
import { toArray } from './src/stream/collectors';
import { collect } from './src/stream/stream';
import { SymbolTableBuilder } from './src/analysis/st_builder';
import { StatementsNode } from './src/ast/statements';
import { VariableDeclarationNode } from './src/ast/var';
import { StackFrame, StackFrameBuilder } from './src/analysis/stack_frame';
import { Assembly, Compiler } from './src/compile/dolphin/compiler';

const replacer = (key: string, value: any) => {
    if(typeof(value) === "bigint") {
        return value.toString();
    }
    if(key == "position") {
        return `${value.source}:${value.fromLine}:${value.fromLineIdx}->${value.toLine}:${value.toLineIdx}`;
    }
    if(key == "generatedScope") {
        return value.path;
    }
    if(key == "table") {
        return undefined;
    }
    return value;
};

const input = fs.readFileSync("input.prgm").toString('utf-8');
console.log("----------\n\n" + input + "\n\n----------\n");
const lexer = new Lexer(input, "input.prgm");

const parser = new Parser(lexer);

const ast = parser.parseAST();

const st_builder = new SymbolTableBuilder();
st_builder.addAST(ast);
const symbols = st_builder.build();

const sf_builder = new StackFrameBuilder(symbols);
sf_builder.generate(ast, sf_builder.build(symbols.root));

fs.writeFileSync("ast.json", JSON.stringify(ast, replacer, 4));
fs.writeFileSync("symbols.json", JSON.stringify(symbols, replacer, 4));

const compiler = new Compiler(symbols, new Assembly());
compiler.compile(ast, (ast as StatementsNode).generatedScope?.stackframe as StackFrame);

console.log('Done.\n');

console.log(compiler.assembly.finish());