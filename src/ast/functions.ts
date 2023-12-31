import { RUNTIME_VOID, RuntimeType, RuntimeVoid } from "../analysis/rt_type";
import { SymbolScopeFunction, SymbolVariable } from "../analysis/symbol_table";
import { Position, TokenSymbol } from "../lexer/token";
import { AstNode } from "./ast";
import { ExpressionNode, SymbolNode } from "./expression";
import { StatementsNode } from "./statements";
import { TypeNode } from "./type";

export interface FunctionParameter {
    resolvedVariable?: SymbolVariable;
    name: string;
    type: TypeNode;
    position: Position;
}

export class FunctionDeclarationNode implements AstNode {
    public readonly type: "fun_decl" = "fun_decl";
    public runtimeType: RuntimeVoid = RUNTIME_VOID;
    public generatedScope: SymbolScopeFunction | null = null;
    constructor(public readonly name: TokenSymbol, public readonly parameters: FunctionParameter[], public readonly ret_type: TypeNode, public readonly body: StatementsNode | null, public readonly position: Position) {}

    noNeedSemicolon(): boolean {
        return this.body != null;
    }
}

export class FunctionCallNode implements AstNode {
    public readonly type: "fun_call" = "fun_call";
    public runtimeType: RuntimeType | null = null;
    constructor(public readonly name: SymbolNode, public readonly args: ExpressionNode[], public position: Position) {}
}