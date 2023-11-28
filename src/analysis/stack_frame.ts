import { ASTNode } from "../ast/ast";
import { getTypeSizeBytes } from "./rt_type";
import { SymbolTable, SymbolScope, SymbolVariable } from "./symbol_table";

export interface StackFrameVariable {
    index: number;
    sizeBytes: number;
    ref?: SymbolVariable;
}

export const FRAME_OFFSET_SIZE = 1;

export class StackFrame {
    public readonly sizeBytes: number;
    private variables: {[key: string]: Readonly<StackFrameVariable>};

    constructor(vars: SymbolVariable[], public scope: SymbolScope, public parentStackFrame?: StackFrame) {
        this.variables = {};
        let size = 0;
        for(const variable of vars) {
            if(!variable) continue;
            if(!variable.resolved_var_type) {
                throw new Error(`Variable '${variable.name}' has unresolved type: ${JSON.stringify(variable.var_type_node)}`);
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

    get_reserved(offset: number, size: number = 1): StackFrameVariable {
        return {
            index: offset, sizeBytes: size
        };
    }

    find(name: string): Readonly<StackFrameVariable> | null {
        return this.variables[name] ?? null;
    }
}

export class StackFrameBuilder {
    constructor(public readonly symbol_table: SymbolTable) {}

    generate(node: ASTNode, parentStackFrame: StackFrame) {
        if(node.type == 'statements') {
            if(!node.generatedScope) return;
            node.generatedScope.stackframe = this.build(node.generatedScope, parentStackFrame);
            for(const stmt of node.statements) {
                this.generate(stmt, node.generatedScope.stackframe);
            }
        } else if(node.type == 'var_decl') {
            this.generate(node.var_type, parentStackFrame);
            if(node.value) {
                this.generate(node.value, parentStackFrame);
            }
        } else if(node.type == 'bin_add' || node.type == 'bin_sub' || node.type == 'bin_or' || node.type == 'bin_and' || node.type == 'bin_xor') {
            this.generate(node.left, parentStackFrame);
            this.generate(node.right, parentStackFrame);
        } else if(node.type == 'if_else') {
            this.generate(node.condition, parentStackFrame);
            this.generate(node.if_branch, parentStackFrame);
            if(node.else_branch) {
                this.generate(node.else_branch, parentStackFrame);
            }
        } else if(node.type == 'var_assign') {
            this.generate(node.name, parentStackFrame);
            this.generate(node.value, parentStackFrame);
        } else if(node.type == 'while_loop') {
            this.generate(node.condition, parentStackFrame);
            this.generate(node.loop_body, parentStackFrame);
        } else if(node.type == 'assembly') {
            for(const inst of node.instructions) {
                this.generate(inst, parentStackFrame);
            }
        } else if(node.type == 'asm_command') {
            for(const arg of node.args) {
                this.generate(arg, parentStackFrame);
            }
        } else if(node.type == 'fun_decl') {
            if(!node.body) return;
            if(!node.generatedScope) {
                throw new Error(`No scope generated for function ${node.name}`);
            }
            this.generate(node.ret_type, parentStackFrame);
            const frame = this.build(node.generatedScope);
            node.generatedScope.stackframe = frame;
            for(const parameter of node.parameters) {
                this.generate(parameter.type, frame);
            }
            this.generate(node.body, frame);
        } else if(node.type == 'fun_call') {
            this.generate(node.name, parentStackFrame);
            for(const arg of node.args) {
                this.generate(arg, parentStackFrame);
            }
        } else if(node.type == 'litteral_instruction' || node.type == 'break_loop' || node.type == 'continue_loop' || node.type == 'void_expr' || node.type == 'native_type' || node.type == 'integer' || node.type == 'string' || node.type == 'symbol') {
            return;
        } else {
            throw new Error(`StackFrameBuilder.generate(): Unknown node ${(node as ASTNode).type}`);
        }
    }

    build(scope: SymbolScope, parentStackFrame?: StackFrame): StackFrame {
        if(scope.table != this.symbol_table) throw new Error("Invalid scope given");
        const vars: SymbolVariable[] = [];
        for(const key in scope.children) {
            const child = scope.children[key];
            if(child.type == "variable") {
                vars.push(child);
            }
        }
        return new StackFrame(vars.reverse(), scope, parentStackFrame);
    }
}