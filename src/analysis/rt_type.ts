import { keyword } from "../lexer/token";

export type RuntimeType = RuntimeVoid | RuntimeNativeTypeName | RuntimeTypeInteger;

export interface RuntimeVoid {
    type: "runtime_void";
}

export interface RuntimeNativeTypeName {
    type: "native_typename";
    name: keyword;
}

export interface RuntimeTypeInteger {
    type: "runtime_int";
    unsigned: boolean;
    bytes: number;
}

export const RUNTIME_VOID: Readonly<RuntimeVoid> = Object.freeze({ type: "runtime_void" });
export const RUNTIME_UINT8: Readonly<RuntimeTypeInteger> = Object.freeze({ type: "runtime_int", unsigned: true, bytes: 1 });
export const RUNTIME_UINT16: Readonly<RuntimeTypeInteger> = Object.freeze({ type: "runtime_int", unsigned: true, bytes: 2 });

export function getTypeSizeBytes(type: RuntimeType): number {
    if(type.type == "runtime_void" || type.type == "native_typename") {
        return 0;
    }
    if(type.type == "runtime_int") {
        return type.bytes;
    }
    throw new Error("Unknown type");
}