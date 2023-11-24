import { Lexer } from "../lexer/lexer";
import { Position, Token, TokenInteger, TokenKeyword, TokenString, TokenSymbol, extendPosition, keyword, operator } from "../lexer/token";
import { CancelableStream, cancelableOf } from "../stream/stream";
import { StatementNode, StatementsNode } from "../ast/statements";
import { VariableAssignmentNode, VariableDeclarationNode } from "../ast/var";
import { AdditionNode, ExpressionNode, IntegerNode, StringNode, SubtractionNode, SymbolNode, VoidNode } from "../ast/expression";
import { NativeTypeNode, TypeNode } from "../ast/type";
import { ASTNode } from "../ast/ast";
import { BreakNode, ContinueNode, IfElseNode, WhileLoopNode } from "../ast/controlflow";
import { AsmCommandNode, AssemblyNode, InstructionNode, LitteralInstructionNode } from "../ast/asm";
import { FunctionCallNode, FunctionDeclarationNode, FunctionParameter } from "../ast/functions";

export class Parser {

    private stream: CancelableStream<Token>;

    constructor(private lexer: Lexer) {
        this.stream = cancelableOf(lexer);
    }

    parseAST(): ASTNode {
        const stmts = this.parseStatements();
        if(!stmts) {
            throw new Error("Can't parse program");
        }
        return stmts;
    }

    private isKeyword(...kw: keyword[]): boolean {
        const tok = this.stream.peek();
        return tok?.type == "keyword" && kw.includes(tok.keyword);
    }

    private isOperator(...op: operator[]): boolean {
        const tok = this.stream.peek();
        return op.includes(tok?.type as any);
    }

    private parseStatements(): StatementsNode | null {
        if(!this.stream.peek()) {
            return null;
        }
        let position: Position = this.stream.peek()?.position as Position;
        if(this.stream.peek()?.type == "{") this.stream.next();
        let statements: StatementNode[] = [];
        while(this.stream.peek()?.type != "}" && (statements.length == 0 || (statements[statements.length - 1] as any)?.noNeedSemicolon?.() || this.stream.peek()?.type == ";")) {
            while(this.stream.peek()?.type == ";") this.stream.next();
            if(this.stream.peek()?.type == "}") break;
            if(this.stream.peek()?.type == "eof") break;
            const statement = this.parseStatement();
            if(!statement) break;
            statements.push(statement);
            position = extendPosition(position, statement.position);
        }
        return new StatementsNode(statements, position);
    }
    
    private parseStatement(): StatementNode {
        if(this.stream.peek()?.type == "{") {
            
            const stmts = this.parseStatements();
            if(!stmts) {
                throw new Error("Expected statments");
            }
            if(this.stream.peek()?.type != "}") {
                throw new Error("Expected '}' or more statements");
            }
            this.stream.next();
            return stmts;
        }
        if(this.isKeyword("let")) {
            return this.parseVariableDeclaration();
        }
        if(this.isKeyword("while")) {
            return this.parseWhileLoop();
        }
        if(this.isKeyword("break")) {
            return new BreakNode(this.stream.next()?.position as Position);
        }
        if(this.isKeyword("continue")) {
            return new ContinueNode(this.stream.next()?.position as Position);
        }
        if(this.isKeyword("asm")) {
            return this.parseAssembly();
        }
        if(this.isKeyword("function")) {
            return this.parseFunctionDeclaration();
        }
        return this.parseExpression();
    }

    private parseExpression(): ExpressionNode {
        if(this.isKeyword("if")) {
            return this.parseIfStatement();
        }
        return this.parseAddition();
    }

    private parseFunctionDeclaration(): FunctionDeclarationNode {
        const kw_function = this.stream.next() as TokenKeyword;
        if(this.stream.peek()?.type != 'symbol') {
            throw new Error(`Expected parameter name or ')', got ${this.stream.peek()?.type}`);
        }
        const name = this.stream.next() as TokenSymbol;
        if(!this.isOperator('(')) {
            throw new Error(`Expected '(', got ${this.stream.peek()?.type}`);
        }
        this.stream.next();
        const parameters: FunctionParameter[] = [];
        if(!this.isOperator(')')) {
            while(true) {
                if(this.stream.peek()?.type != 'symbol') {
                    throw new Error(`Expected parameter name or ')', got ${this.stream.peek()?.type}`);
                }
                const name = this.stream.next() as TokenSymbol;
                if(!this.isOperator(':')) {
                    throw new Error(`Expected ':', got ${this.stream.peek()?.type}`);
                }
                this.stream.next();
                const type = this.parseType();
                parameters.push({
                    name: name.name, type, position: extendPosition(name.position, type.position)
                });
                if(this.isOperator(')')) {
                    break;
                }
                if(!this.isOperator(',')) {
                    throw new Error(`Expected ',' or ')', got ${this.stream.peek()?.type}`);
                }
            }
        }
        this.stream.next();
        if(!this.isOperator(':')) {
            throw new Error(`Expected ':', got ${this.stream.peek()?.type}`);
        }
        this.stream.next();
        const ret_type = this.parseType();
        if(this.isOperator(';')) {
            return new FunctionDeclarationNode(name, parameters, ret_type, null, extendPosition(kw_function.position, ret_type.position));
        }
        if(!this.isOperator('{')) {
            throw new Error(`Expected '{', got ${this.stream.peek()?.type}`);
        }
        this.stream.next();
        const body = this.parseStatements();
        if(!body) {
            throw new Error(`Can't parse function body`);
        }
        if(!this.isOperator('}')) {
            throw new Error(`Expected '}', got ${this.stream.peek()?.type}`);
        }
        const end = this.stream.next() as Token;
        return new FunctionDeclarationNode(name, parameters, ret_type, body, extendPosition(kw_function.position, end.position));
    }

    private parseAssembly(): AssemblyNode {
        const kw_asm = this.stream.next() as TokenKeyword;
        const targets: string[] = [];
        while(this.stream.peek()?.type == "string") {
            targets.push((this.stream.next() as TokenString).value);
        }
        if(!this.isOperator('{')) {
            throw new Error(`Expected '{', got ${this.stream.peek()?.type}`);
        }
        this.stream.next();
        const instructions: InstructionNode[] = [];
        while(this.stream.peek()?.type != '}' || this.stream.peek()?.type == ';') {
            while(this.stream.peek()?.type == ";") this.stream.next();
            if(this.stream.peek()?.type == "}") break;
            if(this.stream.peek()?.type == "eof") break;
            const inst = this.parseAsmInstruction();
            if(!inst) break;
            instructions.push(inst);
        }
        if(!this.isOperator('}')) {
            throw new Error(`Expected '}' or assembly instruction, got ${this.stream.peek()?.type}`);
        }
        return new AssemblyNode(targets, instructions, extendPosition(kw_asm.position, this.stream.next()?.position as Position));
    }

    private parseAsmInstruction(): InstructionNode | null {
        if(this.stream.peek()?.type == 'string') {
            const tok = this.stream.next() as TokenString;
            return new LitteralInstructionNode(tok.value, tok.position);
        }
        if(this.stream.peek()?.type == ':') {
            const colon = this.stream.next() as TokenSymbol;
            if(this.stream.peek()?.type != 'string') {
                throw new Error(`Expected assembly command (string litteral), got ${this.stream.peek()?.type}`);
            }
            const command = this.stream.next() as TokenString;
            let position = extendPosition(colon.position, command.position);
            const args: ExpressionNode[] = [];
            while(this.stream.peek()?.type == ':') {
                this.stream.next();
                const expression = this.parseExpression();
                args.push(expression);
                position = extendPosition(position, expression.position);
            }
            return new AsmCommandNode(command, args, position);
        }
        return null;
    }

    private parseWhileLoop(): WhileLoopNode {
        const kw_while = this.stream.next() as TokenKeyword;
        if(!this.isOperator('(')) {
            throw new Error(`Expected '(', got ${this.stream.peek()?.type}`);
        }
        this.stream.next();
        const condition = this.parseExpression();
        if(!this.isOperator(')')) {
            throw new Error(`Expected ')', got ${this.stream.peek()?.type}`);
        }
        this.stream.next();
        const loop_body = this.parseStatement();
        return new WhileLoopNode(condition, loop_body, extendPosition(kw_while.position, loop_body.position));
    }

    private parseIfStatement(): IfElseNode {
        const kw_if = this.stream.next() as TokenKeyword;
        if(!this.isOperator('(')) {
            throw new Error(`Expected '(', got ${this.stream.peek()?.type}`);
        }
        this.stream.next();
        const condition = this.parseExpression();
        if(!this.isOperator(')')) {
            throw new Error(`Expected ')', got ${this.stream.peek()?.type}`);
        }
        this.stream.next();
        const if_branch = this.parseStatement();
        if(this.isKeyword('else')) {
            this.stream.next();
            const else_branch = this.parseStatement();
            return new IfElseNode(condition, if_branch, else_branch, extendPosition(kw_if.position, else_branch.position));
        }
        return new IfElseNode(condition, if_branch, null, extendPosition(kw_if.position, if_branch.position));
    }

    private parseAddition(): ExpressionNode {
        let left = this.parseAtom();
        while(this.isOperator("+", "-")) {
            const operator = this.stream.next() as Token;
            const right = this.parseAtom();
            if(operator.type == "+") {
                left = new AdditionNode(left, right, extendPosition(left.position, right.position));
            } else if(operator.type == "-") {
                left = new SubtractionNode(left, right, extendPosition(left.position, right.position));
            } else {
                throw new Error(`Unsupported binary operator: ${operator.type}`);
            }
        }
        return left;
    }

    private parseAtom(): ExpressionNode {
        if(this.isKeyword("void")) {
            return new VoidNode(this.stream.next()?.position as Position);
        }
        if(this.stream.peek()?.type == "integer") {
            const token = this.stream.next() as TokenInteger;
            return new IntegerNode(token.value, token.position);
        }
        if(this.stream.peek()?.type == "string") {
            const token = this.stream.next() as TokenString;
            return new StringNode(token.value, token.position);
        }
        if(this.stream.peek()?.type == "symbol") {
            const token = this.stream.next() as TokenSymbol;
            const symbol = new SymbolNode(token.name, token.position);
            if(this.stream.peek()?.type == "=") {
                this.stream.next();
                const expr = this.parseExpression();
                return new VariableAssignmentNode(symbol, expr, extendPosition(symbol.position, expr.position));
            }
            if(this.stream.peek()?.type == "(") {
                this.stream.next();
                const args: ExpressionNode[] = [];
                if(!this.isOperator(")")) {
                    while(true) {
                        const expr = this.parseExpression();
                        args.push(expr);
                        if(this.isOperator(")")) {
                            break;
                        }
                        if(!this.isOperator(",")) {
                            throw new Error(`Expected ',' or ')', got ${this.stream.peek()?.type}`);
                        }
                    }
                }
                const end_paren = this.stream.next() as Token;
                return new FunctionCallNode(symbol, args, extendPosition(symbol.position, end_paren.position));
            }
            return symbol;
        }
        if(this.isOperator('(')) {
            const paren = this.stream.next() as Token;
            const expr = this.parseExpression();
            if(!this.isOperator(')')) {
                throw new Error(`Expected ')', got ${this.stream.peek()?.type}`);
            }
            expr.position = extendPosition(paren.position, this.stream.next()?.position as Position);
            return expr;
        }
        if(this.isOperator('{')) {
            const brace = this.stream.next() as Token;
            const expr = this.parseStatements();
            if(!expr) {
                throw new Error(`Couldn't parse statements`);
            }
            if(!this.isOperator('}')) {
                throw new Error(`Expected '}', got ${this.stream.peek()?.type}`);
            }
            expr.position = extendPosition(brace.position, this.stream.next()?.position as Position);
            return expr;
        }
        throw new Error(`Expected expression, got ${this.stream.peek()?.type}`);
    }

    private parseType(): TypeNode {
        if(this.isKeyword("u8", "u16", "void")) {
            return new NativeTypeNode((this.stream.peek() as TokenKeyword).keyword, this.stream.next()?.position as Position);
        }
        throw new Error(`Expected type, got ${this.stream.peek()?.type}`);
    }

    private parseVariableDeclaration(): VariableDeclarationNode {
        const let_kw = this.stream.next() as Token;
        if(this.stream.peek()?.type != "symbol") {
            throw new Error(`Expected variable name, got ${this.stream.peek()?.type}`);
        }
        const name = this.stream.next() as TokenSymbol;

        if(this.stream.peek()?.type != ":") {
            throw new Error(`Expected ':', got ${this.stream.peek()?.type}`);
        }
        this.stream.next();

        const type = this.parseType();

        if(this.stream.peek()?.type == "=") {
            this.stream.next();

            const value = this.parseExpression();
            const position = extendPosition(let_kw.position, value.position);
        
            return new VariableDeclarationNode(name, type, value, position);
        }

        const semi = this.stream.peek();
        if(semi?.type != ";") {
            throw new Error(`Expected ';' or '=', got ${this.stream.peek()?.type}`);
        }
        const position = extendPosition(let_kw.position, semi.position);

        return new VariableDeclarationNode(name, type, null, position);
    }
}