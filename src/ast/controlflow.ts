import { RUNTIME_VOID, RuntimeType, RuntimeVoid } from "../analysis/rt_type";
import { SymbolLoopScope } from "../analysis/symbol_table";
import { Position } from "../lexer/token";
import { AstNode } from "./ast";
import { ExpressionNode } from "./expression";
import { StatementNode } from "./statements";

export class IfElseNode implements AstNode {
    public readonly type: "if_else" = "if_else";
    public runtimeType: RuntimeType | null = null;
    constructor(public readonly condition: ExpressionNode, public readonly if_branch: StatementNode, public readonly else_branch: StatementNode | null, public position: Position) {}

    noNeedSemicolon(): boolean {
        if(!this.else_branch) {
            return (this.if_branch as any)?.noNeedSemicolon?.() ?? false;
        }
        return (this.else_branch as any)?.noNeedSemicolon?.() ?? false;
    }
}

export class WhileLoopNode implements AstNode {
    public readonly type: "while_loop" = "while_loop";
    public runtimeType: RuntimeVoid = RUNTIME_VOID;
    constructor(public readonly condition: ExpressionNode, public readonly loop_body: StatementNode, public position: Position) {}

    noNeedSemicolon(): boolean {
        return (this.loop_body as any)?.noNeedSemicolon?.() ?? false;
    }
}

export class BreakNode implements AstNode {
    public readonly type: "break_loop" = "break_loop";
    public runtimeType: RuntimeVoid = RUNTIME_VOID;
    public loopScope: SymbolLoopScope | null = null;
    constructor(public readonly position: Position) {}
}

export class ContinueNode implements AstNode {
    public readonly type: "continue_loop" = "continue_loop";
    public runtimeType: RuntimeVoid = RUNTIME_VOID;
    public loopScope: SymbolLoopScope | null = null;
    constructor(public readonly position: Position) {}
}