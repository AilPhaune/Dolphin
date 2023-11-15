import { RuntimeType } from "../analysis/rt_type";
import { Position } from "../lexer/token";
import { ExpressionNode } from "./expression";
import { StatementNode } from "./statements";
import { TypeNode } from "./type";

export interface AstNode {
    type: string;
    position: Position;
    runtimeType: RuntimeType | null;
}

export type ASTNode = ExpressionNode | StatementNode | TypeNode;