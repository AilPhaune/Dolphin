import { RuntimeNativeTypeName } from "../analysis/rt_type";
import { Position, keyword } from "../lexer/token";
import { AstNode } from "./ast";

export type TypeNode = NativeTypeNode;

export class NativeTypeNode implements AstNode {
    public readonly type: "native_type" = "native_type";
    public readonly runtimeType: RuntimeNativeTypeName | null;

    constructor(public readonly kw: keyword, public readonly position: Position) {
        this.runtimeType = {
            type: "native_typename",
            name: kw
        };
    }
}