import { RuntimeNativeTypeName, RuntimeType } from "../analysis/rt_type";
import { SymbolTable } from "../analysis/symbol_table";
import { Position, keyword } from "../lexer/token";
import { AstNode } from "./ast";

export type TypeNode = NativeTypeNode;

export class NativeTypeNode implements AstNode {
    public readonly type: "native_type" = "native_type";
    public readonly kwType: RuntimeNativeTypeName;
    public readonly runtimeType: RuntimeType;

    constructor(public readonly kw: keyword, public readonly position: Position) {
        this.kwType = {
            type: "native_typename",
            name: kw
        };
        this.runtimeType = SymbolTable.resolveType(this.kwType) as any;
    }
}