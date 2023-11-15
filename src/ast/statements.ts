import { RuntimeType } from "../analysis/rt_type";
import { SymbolScope } from "../analysis/symbol_table";
import { Position } from "../lexer/token";
import { AstNode } from "./ast";
import { ExpressionNode } from "./expression";
import { VariableDeclarationNode } from "./var";

export type StatementNode = StatementsNode | VariableDeclarationNode | ExpressionNode;

export class StatementsNode implements AstNode {
    public readonly type: "statements" = "statements";
    public generatedScope: SymbolScope | null = null;
    public runtimeType: RuntimeType | null = null;
    constructor(public statements: StatementNode[], public position: Position) {}

    noNeedSemicolon(): true {
        return true;
    }
};