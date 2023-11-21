import { RuntimeType } from "../analysis/rt_type";
import { SymbolScope } from "../analysis/symbol_table";
import { Position } from "../lexer/token";
import { ASMNode } from "./asm";
import { AstNode } from "./ast";
import { BreakNode, ContinueNode, WhileLoopNode } from "./controlflow";
import { ExpressionNode } from "./expression";
import { VariableDeclarationNode } from "./var";
import { FunctionDeclarationNode } from "./functions";

export type StatementNode = StatementsNode | VariableDeclarationNode | ExpressionNode | WhileLoopNode | BreakNode | ContinueNode | ASMNode | FunctionDeclarationNode;

export class StatementsNode implements AstNode {
    public readonly type: "statements" = "statements";
    public generatedScope: SymbolScope | null = null;
    public runtimeType: RuntimeType | null = null;
    constructor(public statements: StatementNode[], public position: Position) {}

    noNeedSemicolon(): true {
        return true;
    }
};