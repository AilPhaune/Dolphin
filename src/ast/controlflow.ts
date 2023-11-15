import { RuntimeType } from "../analysis/rt_type";
import { Position } from "../lexer/token";
import { AstNode } from "./ast";
import { ExpressionNode } from "./expression";
import { StatementNode } from "./statements";

export class IfElseNode implements AstNode {
    public readonly type: "if_else" = "if_else";
    public runtimeType: RuntimeType | null = null;
    constructor(public readonly condition: ExpressionNode, public readonly if_branch: StatementNode, public readonly else_branch: StatementNode | null, public position: Position) {}
}