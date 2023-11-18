import { keyword } from "../lexer/token";

export type RuntimeType = RuntimeVoid | RuntimeNativeTypeName | RuntimeTypeInteger | RuntimeTypeString;

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

export interface RuntimeTypeString {
    type: "runtime_string";
    length: number;
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
    if(type.type == "runtime_string") {
        return type.length;
    }
    throw new Error("Unknown type");
}

export function areTypesEqual(a: RuntimeType | null | undefined, b: RuntimeType | null | undefined) {
    if(!a) return !b;
    if(!b) return false;
    if(a == b) return true;
    if(a.type != b.type) return false;
    if(a.type == 'runtime_void') return true;
    if(a.type == 'native_typename') return a.name == (b as RuntimeNativeTypeName).name;
    if(a.type == 'runtime_int') return a.bytes == (b as RuntimeTypeInteger).bytes && a.unsigned == (b as RuntimeTypeInteger).unsigned;
    if(a.type == 'runtime_string') return a.length == (b as RuntimeTypeString).length;
    throw new Error(`areTypesEqual(): ${a} not implemented`);
}