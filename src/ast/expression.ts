import { RUNTIME_UINT16, RUNTIME_UINT8, RUNTIME_VOID, RuntimeType, RuntimeTypeInteger, RuntimeVoid } from "../analysis/rt_type";
import { Symbol } from "../analysis/symbol_table";
import { Position } from "../lexer/token";
import { AstNode } from "./ast";
import { IfElseNode } from "./controlflow";
import { StatementsNode } from "./statements";
import { VariableAssignmentNode } from "./var";

export type ExpressionNode = IntegerNode | SymbolNode | StatementsNode | AdditionNode | SubtractionNode | IfElseNode | VariableAssignmentNode | VoidNode;

export class AdditionNode implements AstNode {
    public readonly type: "bin_add" = "bin_add";
    public runtimeType: RuntimeType | null = null;
    constructor(public readonly left: ExpressionNode, public readonly right: ExpressionNode, public position: Position) {}
}

export class SubtractionNode implements AstNode {
    public readonly type: "bin_sub" = "bin_sub";
    public runtimeType: RuntimeType | null = null;
    constructor(public readonly left: ExpressionNode, public readonly right: ExpressionNode, public position: Position) {}
}

export class IntegerNode implements AstNode {
    public readonly type: "integer" = "integer";
    public runtimeType: RuntimeTypeInteger | null;
    constructor(public readonly value: bigint, public position: Position) {
        if(value <= 255) {
            this.runtimeType = RUNTIME_UINT8;
        } else if(value <= 65535) {
            this.runtimeType = RUNTIME_UINT16;
        } else {
            this.runtimeType = null;
        }
    }
}

export class SymbolNode implements AstNode {
    public readonly type: "symbol" = "symbol";
    public runtimeType: RuntimeType | null = null;
    public resolvedSymbol: Symbol | null = null;
    constructor(public readonly name: string, public position: Position) {}
}

export class VoidNode implements AstNode {
    public readonly type: "void_expr" = "void_expr";
    public runtimeType: RuntimeVoid = RUNTIME_VOID;
    constructor(public position: Position) {}
}