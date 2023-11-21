import { SymbolTable, SymbolScope, Symbol } from './symbol_table';
import { ASTNode } from '../ast/ast';
import { RUNTIME_UINT8, RUNTIME_VOID, RuntimeType } from './rt_type';

export class SymbolTableBuilder {

    public readonly symbol_table: SymbolTable;

    private asts: ASTNode[];

    constructor() {
        this.symbol_table = new SymbolTable();
        this.asts = [];
    }

    addAST(node: ASTNode): void {
        this.asts.push(node);
    }

    build(): SymbolTable {
        for(const ast of this.asts) {
            this.findDeclarations(ast, this.symbol_table.root);
        }
        for(const ast of this.asts) {
            this.resolveTypes(ast, this.symbol_table.root);
        }
        return this.symbol_table;
    }

    private findDeclarations(node: ASTNode, parent: SymbolScope) {
        if(node.type == 'var_decl') {
            node.generatedScope = SymbolTable.addVariable(parent, node.name.name, node.var_type, node.position);
            this.findDeclarations(node.var_type, parent);
            if(node.value) {
                this.findDeclarations(node.value, parent);
            }
        } else if(node.type == 'statements') {
            const scope = SymbolTable.addAnonymousScope(parent, true, node.position);
            node.generatedScope = scope;
            for(const stmt of node.statements) {
                this.findDeclarations(stmt, scope);
            }
        } else if(node.type == 'bin_add' || node.type == 'bin_sub') {
            this.findDeclarations(node.left, parent);
            this.findDeclarations(node.right, parent);
        } else if(node.type == 'if_else') {
            this.findDeclarations(node.condition, parent);
            this.findDeclarations(node.if_branch, parent);
            if(node.else_branch) {
                this.findDeclarations(node.else_branch, parent);
            }
        } else if(node.type == 'var_assign') {
            this.findDeclarations(node.name, parent);
            this.findDeclarations(node.value, parent);
        } else if(node.type == 'while_loop') {
            this.findDeclarations(node.condition, parent);
            this.findDeclarations(node.loop_body, parent);
            if(node.loop_body.type == 'statements') {
                if(!node.loop_body.generatedScope) {
                    throw new Error(`Failed to generate scope for while loop body`);
                }
                node.loop_body.generatedScope.specialType = 'loop';
            }
        } else if(node.type == 'assembly') {
            for(const inst of node.instructions) {
                this.findDeclarations(inst, parent);
            }
        } else if(node.type == 'asm_command') {
            for(const arg of node.args) {
                this.findDeclarations(arg, parent);
            }
        } else if(node.type == 'fun_decl') {
            this.findDeclarations(node.ret_type, parent);
            const scope = SymbolTable.addFunctionScope(parent.table, node.name.name, node.parameters);
            node.generatedScope = scope;
            for(const param of node.parameters) {
                this.findDeclarations(param.type, scope);
            }
            if(node.body) {
                for(const stmt of node.body.statements) {
                    this.findDeclarations(stmt, scope);
                }
                scope.isBodyDeclared = true;
            }
        } else if(node.type == 'fun_call') {
            this.findDeclarations(node.name, parent);
            for(const arg of node.args) {
                this.findDeclarations(arg, parent);
            }
        } else if(node.type == 'litteral_instruction' || node.type == 'break_loop' || node.type == 'continue_loop' || node.type == 'void_expr' || node.type == 'integer' || node.type == 'string' || node.type == 'symbol' || node.type == 'native_type') {
            return;
        } else {
            throw new Error(`SymbolTableBuilder.findDeclarations(): Unknown node type ${(node as any).type}`);
        }
    }

    private resolveTypes(node: ASTNode, parent: SymbolScope) {
        if(node.type == 'var_decl') {
            if(!node.generatedScope) {
                throw new Error(`Scope for declarated variable ${node} not generated.`);
            }
            node.runtimeType = RUNTIME_VOID;
            this.resolveTypes(node.var_type, parent);
            if(!node.var_type.runtimeType) {
                throw new Error(`Failed to parse runtime type for NodeType ${node.var_type}`);
            }
            node.generatedScope.resolved_var_type = SymbolTable.resolveType(node.var_type.runtimeType);
            if(node.value) {
                this.resolveTypes(node.value, parent);
            }
        } else if(node.type == 'statements') {
            if(!node.generatedScope) {
                throw new Error(`Scope for statements ${node} not generated.`);
            }
            node.runtimeType = RUNTIME_VOID;
            for(const stmt of node.statements) {
                this.resolveTypes(stmt, node.generatedScope);
                node.runtimeType = stmt.runtimeType;
            }
        } else if(node.type == 'bin_add' || node.type == 'bin_sub') {
            this.resolveTypes(node.left, parent);
            this.resolveTypes(node.right, parent);
            if(node.left.runtimeType != RUNTIME_UINT8 || node.right.runtimeType != RUNTIME_UINT8) {
                throw new Error("Math is limited to adding two u8");
            }
            node.runtimeType = RUNTIME_UINT8;
        } else if(node.type == 'if_else') {
            this.resolveTypes(node.condition, parent);
            this.resolveTypes(node.if_branch, parent);
            if(node.else_branch) {
                this.resolveTypes(node.else_branch, parent);
                if(node.if_branch.runtimeType != node.else_branch.runtimeType) {
                    throw new Error(`The two branches of if/else don't have the same return type`);
                }
            }
            node.runtimeType = node.if_branch.runtimeType;
        } else if(node.type == 'symbol') {
            node.resolvedSymbol = SymbolTable.resolveSymbol(parent, node.name);
            if(!node.resolvedSymbol) {
                throw new Error(`Symbol '${node.name}' can't be resolved`);
            }
            if(node.resolvedSymbol.type == "variable") {
                node.runtimeType = node.resolvedSymbol.resolved_var_type as RuntimeType;
            } else if(node.resolvedSymbol.type == "scope") {
                node.runtimeType = RUNTIME_VOID;
            } else {
                throw new Error(`Resolved symbol '${(node.resolvedSymbol as Symbol).path}' doesn't have a type`);
            }
        } else if(node.type == 'var_assign') {
            this.resolveTypes(node.name, parent);
            this.resolveTypes(node.value, parent);
            if(!node.name.resolvedSymbol) {
                throw new Error(`Can't resolve symbol ${node.name.name}`);
            }
            if(node.name.resolvedSymbol.type != 'variable') {
                throw new Error(`Can only assign a value to a variable, but not to '${node.name.resolvedSymbol.type}'`);
            }
            node.resolvedVariable = node.name.resolvedSymbol;
            if(!node.resolvedVariable.resolved_var_type) {
                throw new Error(`Type of variable ${node.resolvedVariable.path} could not be resolved`);
            }
            node.runtimeType = node.resolvedVariable.resolved_var_type;
        } else if(node.type == 'while_loop') {
            this.resolveTypes(node.condition, parent);
            this.resolveTypes(node.loop_body, parent);
            node.loop_body.runtimeType = RUNTIME_VOID;
            node.runtimeType = RUNTIME_VOID;
        } else if(node.type == 'break_loop' || node.type == 'continue_loop') {
            // Find which loop
            do {
                if(parent.type == 'scope' && parent.specialType == 'loop') {
                    node.loopScope = parent;
                }
                const p = SymbolTable.findParent(parent);
                if(!p) break;
                parent = p;
            } while(true);
            if(!node.loopScope) {
                throw new Error(`Attempt to use loop control while not in a loop`);
            }
            node.runtimeType = RUNTIME_VOID;
        } else if(node.type == 'assembly') {
            for(const inst of node.instructions) {
                this.resolveTypes(inst, parent);
            }
            node.runtimeType = RUNTIME_VOID;
        } else if(node.type == 'asm_command') {
            for(const arg of node.args) {
                this.resolveTypes(arg, parent);
            }
        } else if(node.type == 'fun_decl') {
            this.resolveTypes(node.ret_type, parent);
            if(!node.generatedScope) {
                throw new Error(`Scope for declarated function ${node.name} not generated.`);
            }
            for(const param of node.parameters) {
                this.resolveTypes(param.type, node.generatedScope);
            }
            if(node.body) {
                for(const stmt of node.body.statements) {
                    this.resolveTypes(stmt, node.generatedScope);
                }
            }
        } else if(node.type == 'fun_call') {
            this.resolveTypes(node.name, parent);
            if(!node.name.resolvedSymbol) {
                throw new Error(`Can't resolve function ${node.name.name}`);
            }
            for(const arg of node.args) {
                this.resolveTypes(arg, parent);
            }
        } else if(node.type == 'void_expr' || node.type == 'native_type' || node.type == 'litteral_instruction' || node.type == 'integer' || node.type == 'string') {
            return;
        } else {
            throw new Error(`SymbolTableBuilder.resolveTypes(): Unknown node type ${(node as any).type}`);
        }
    }
}