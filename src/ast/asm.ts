import { RUNTIME_VOID, RuntimeType, RuntimeVoid } from "../analysis/rt_type";
import { Position, TokenString } from "../lexer/token";
import { AstNode } from "./ast";
import { ExpressionNode, SymbolNode } from "./expression";

export type ASMNode = SymbolNode | AssemblyNode | InstructionNode;

export type InstructionNode = LitteralInstructionNode | AsmCommandNode;

export class AssemblyNode implements AstNode {
    public readonly type: "assembly" = "assembly";
    public runtimeType: RuntimeVoid = RUNTIME_VOID;
    constructor(public readonly targets: string[], public readonly instructions: InstructionNode[], public readonly position: Position) {}

    noNeedSemicolon(): true {
        return true;
    }
};

export class LitteralInstructionNode implements AstNode {
    public readonly type: "litteral_instruction" = "litteral_instruction";
    public runtimeType: RuntimeVoid = RUNTIME_VOID;
    constructor(public readonly value: string, public readonly position: Position) {}
}

export class AsmCommandNode implements AstNode {
    public readonly type: "asm_command" = "asm_command";
    public runtimeType: RuntimeVoid = RUNTIME_VOID;
    constructor(public readonly command: TokenString, public readonly args: ExpressionNode[], public readonly position: Position) {}
}