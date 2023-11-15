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
        } else if(node.type == 'integer' || node.type == 'symbol' || node.type == 'native_type') {
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
        } else if(node.type == 'integer') {
            node.runtimeType = RUNTIME_UINT8;
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
                throw new Error(`Resolved symbole '${(node.resolvedSymbol as Symbol).path}' doesn't have a type`);
            }
        } else if(node.type == 'native_type') {
            return;
        } else {
            throw new Error(`SymbolTableBuilder.resolveTypes(): Unknown node type ${(node as any).type}`);
        }
    }
}