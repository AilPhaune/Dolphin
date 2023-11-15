import { ASTNode } from "../ast/ast";
import { getTypeSizeBytes } from "./rt_type";
import { SymbolTable, SymbolScope, SymbolVariable } from "./symbol_table";

export interface StackFrameVariable {
    index: number;
    sizeBytes: number;
    ref: SymbolVariable;
}

export class StackFrame {
    public parentStackFrame: StackFrame | null = null;

    public readonly sizeBytes: number;
    private variables: {[key: string]: Readonly<StackFrameVariable>};

    constructor(vars: SymbolVariable[]) {
        this.variables = {};
        let size = 0;
        for(const variable of vars) {
            if(!variable) continue;
            if(!variable.resolved_var_type) {
                throw new Error(`Variable has unresolved type: ${variable.var_type_node}`);
            }
            const vsize = getTypeSizeBytes(variable.resolved_var_type);
            this.variables[variable.path] = Object.freeze({
                index: size,
                sizeBytes: vsize,
                ref: variable
            });
            size += vsize;
        }
        this.sizeBytes = size;
    }

    find(name: string): Readonly<StackFrameVariable> | null {
        return this.variables[name] ?? null;
    }
}

export class StackFrameBuilder {
    constructor(public readonly symbol_table: SymbolTable) {}

    generate(node: ASTNode) {
        if(node.type == 'statements') {
            if(!node.generatedScope) return;
            node.generatedScope.stackframe = this.build(node.generatedScope);
            for(const stmt of node.statements) {
                this.generate(stmt);
            }
        } else if(node.type == 'var_decl') {
            this.generate(node.var_type);
            if(node.value) {
                this.generate(node.value);
            }
        } else if(node.type == 'bin_add' || node.type == 'bin_sub') {
            this.generate(node.left);
            this.generate(node.right);
        } else if(node.type == 'if_else') {
            this.generate(node.condition);
            this.generate(node.if_branch);
            if(node.else_branch) {
                this.generate(node.else_branch);
            }
        } else if(node.type == 'native_type' || node.type == 'integer' || node.type == 'symbol') {
            return;
        } else {
            throw new Error(`StackFrameBuilder.generate(): Unknown node ${node}`);
        }
    }

    build(scope: SymbolScope): StackFrame {
        if(scope.table != this.symbol_table) throw new Error("Invalid scope given");
        const vars: SymbolVariable[] = [];
        for(const key in scope.children) {
            const child = scope.children[key];
            if(child.type == "variable") {
                vars.push(child);
            }
        }
        return new StackFrame(vars);
    }
}