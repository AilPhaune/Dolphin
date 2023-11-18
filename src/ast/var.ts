import { RuntimeType } from "../analysis/rt_type";
import { SymbolVariable } from "../analysis/symbol_table";
import { Position, TokenSymbol } from "../lexer/token";
import { AstNode } from "./ast";
import { ExpressionNode, SymbolNode } from "./expression";
import { TypeNode } from "./type";

export class VariableDeclarationNode implements AstNode {
    public readonly type: "var_decl" = "var_decl";
    public runtimeType: RuntimeType | null = null;
    generatedScope: SymbolVariable | null = null;
    constructor(public readonly name: TokenSymbol, public readonly var_type: TypeNode, public readonly value: ExpressionNode | null, public position: Position) {}
}

export class VariableAssignmentNode implements AstNode {
    public readonly type: "var_assign" = "var_assign";
    public runtimeType: RuntimeType | null = null;
    resolvedVariable: SymbolVariable | null = null;
    constructor(public readonly name: SymbolNode, public readonly value: ExpressionNode, public position: Position) {}
}