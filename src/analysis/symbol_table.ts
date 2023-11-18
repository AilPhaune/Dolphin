import { TypeNode } from "../ast/type";
import { Position } from "../lexer/token";
import { RUNTIME_UINT16, RUNTIME_UINT8, RUNTIME_VOID, RuntimeNativeTypeName, RuntimeType } from "./rt_type";
import { StackFrame } from "./stack_frame";

export type Symbol = SymbolVariable | SymbolScope;

export interface SymbolVariable {
    type: "variable";
    name: string;
    path: string;
    var_type_node: TypeNode;
    resolved_var_type?: RuntimeType | null;
    position: Position;
    table: SymbolTable;
}

export interface SymbolScope {
    type: "scope";
    path: string;
    children: {
        [key: string]: Symbol;
    };
    anonymousCount: bigint;
    table: SymbolTable;
    stackframe?: StackFrame;
}

export class SymbolTable {
    public readonly root: SymbolScope;

    constructor() {
        this.root = {
            type: "scope",
            children: {},
            anonymousCount: 0n,
            path: "",
            table: this
        };
    }

    find(name: string, parent: SymbolScope = this.root): Symbol | null {
        const parts = name.split('.');
        if(parts.length == 0) return this.root;
        for(let i = 0; i < parts.length; i++) {
            const child = parent.children[parts[i]];
            if(!child || child.type != "scope") {
                return null;
            }
            parent = child;
        }
        return parent;
    }

    static resolveType(type: RuntimeType): RuntimeType | null {
        if(type.type == "native_typename") {
            if(type.name == "u8") return RUNTIME_UINT8;
            if(type.name == "u16") return RUNTIME_UINT16;
            throw new Error(`Invalid native type '${type.name}'`);
        }
        if(type.type == "runtime_int") return type;
        if(type.type == "runtime_void") return RUNTIME_VOID;
        throw new Error(`Unresolvable runtime type: ${type}`);
    }

    static resolveSymbol(scope: SymbolScope, name: string): Symbol | null {
        do {
            if(name in scope.children) {
                return scope.children[name];
            }
            let path = scope.path.split('.');
            path.pop();
            if(name.length == 0) break;
            const found = scope.table.find(path.join('.'));
            if(!found) break;
            if(found.type != 'scope') break;
            scope = found;
        } while(true);
        return null;
    }

    static addVariable(parent: SymbolScope, name: string, var_type: TypeNode, position: Position): SymbolVariable {
        if(parent.children[name]) {
            throw new Error("Variable already declared");
        }
        const variable: SymbolVariable = {
            type: "variable",
            name,
            path: `${parent.path == "" ? "" : (parent.path + ".")}${name}`,
            var_type_node: var_type,
            position,
            table: parent.table
        };
        parent.children[name] = variable;
        return variable;
    }

    static addAnonymousScope(parent: SymbolScope, isStatic: boolean, position: Position): SymbolScope {
        const name = "$<" + parent.anonymousCount.toString() + ">";
        parent.anonymousCount++;
        const scope: SymbolScope = {
            type: "scope",
            path: `${parent.path == "" ? "" : (parent.path + ".")}${name}`,
            children: {},
            anonymousCount: 0n,
            table: parent.table
        };
        parent.children[name] = scope;
        return scope;
    }
}