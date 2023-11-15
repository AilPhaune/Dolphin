import { RUNTIME_UINT8, RuntimeType, getTypeSizeBytes } from "../../analysis/rt_type";
import { StackFrame } from "../../analysis/stack_frame";
import { SymbolTable } from "../../analysis/symbol_table";
import { ASTNode } from "../../ast/ast";
import fs from "fs";

export class Assembly {
    output: string = "";

    lastPushed: string = "";
    lastPoped: string = "";

    pushPopWait: string | null = null;

    labels: {[key: string]: number} = {};

    stack: number[] = [];

    get stackOffset(): number {
        return this.stack[this.stack.length - 1];
    }

    write(value: string) {
        if(this.pushPopWait) {
            const v = this.pushPopWait;
            this.pushPopWait = null;
            this.write(v);
        }
        this.output += value;
        this.output += "\n";
        this.lastPoped = "";
        this.lastPushed = "";
    }

    finish(): string {
        this.write("");
        return this.output;
    }

    save(file: string) {
        fs.writeFileSync(file, this.output);
    }

    integer(value: number): string {
        return `#${value}`;
    }

    setupStackframe(frame: StackFrame) {
        this.SUB(this.integer(frame.sizeBytes), 'SP');
        this.stack.push(0);
    }

    cleanStackframe(frame: StackFrame) {
        this.ADD(this.integer(frame.sizeBytes), 'SP');
        this.stack.pop();
    }

    saveVariable(name: string, frame: StackFrame, offset: number, source: string) {
        const index = frame.find(name);
        if(!index) {
            throw new Error(`Variable ${name} not found`);
        }
        if(index.sizeBytes <= offset) {
            throw new Error(`Variable space overflow`);
        }
        this.MOV(source, this.stackIndex(index.index + offset + this.stackOffset));
    }

    readVariable(name: string, frame: StackFrame, offset: number, dest: string) {
        const index = frame.find(name);
        if(!index) {
            throw new Error(`Variable ${name} not found`);
        }
        if(index.sizeBytes <= offset) {
            throw new Error(`Variable space overflow`);
        }
        this.MOV(this.stackIndex(index.index + offset + this.stackOffset), dest);
    }

    stackIndex(index: number): string {
        return `{SP}+${index}`;
    }

    fixStackUnpush(bytes: number) {
        this.ADD(this.integer(bytes), "SP");
    }

    nextLabel(name: string): string {
        if(!(name in this.labels)) {
            this.labels[name] = 0;
        }
        const ret = `${name}_${this.labels[name]}`;
        this.labels[name]++;
        return ret;
    }

    ADD(value: string, dest: string) {
        this.write(`ADD ${value}, ${dest}`);
    }

    SUB(value: string, dest: string) {
        this.write(`SUB ${value}, ${dest}`);
    }

    private push() {
        this.stack.push((this.stack.pop() ?? -1) + 1);
    }

    private pop() {
        this.stack.push((this.stack.pop() ?? 1) - 1);
    }

    POP(dest: string) {
        this.pop();
        if(this.lastPushed == dest) {
            this.pushPopWait = null;
            this.lastPushed = "";
            return;
        }
        if(this.pushPopWait) {
            const v = this.pushPopWait;
            this.pushPopWait = null;
            this.write(v);
        }
        this.lastPoped = dest;
        this.pushPopWait = `POP ${dest}`;
    }

    PUSH(src: string) {
        this.push();
        if(this.lastPoped == src) {
            this.pushPopWait = null;
            this.lastPoped = "";
            return;
        }
        if(this.pushPopWait) {
            const v = this.pushPopWait;
            this.pushPopWait = null;
            this.write(v);
        }
        this.lastPushed = src;
        this.pushPopWait = `PUSH ${src}`;
    }

    MOV(value: string, dest: string) {
        this.write(`MOVE ${value}, ${dest}`);
    }

    CMP(a: string, b: string) {
        this.write(`COMP ${a}, ${b}`);
    }

    JMP_EQ(dest: string) {
        this.write(`JUMP, EQ ${dest}`);
    }

    JMP_NEQ(dest: string) {
        this.write(`JUMP, NE ${dest}`);
    }

    JMP_LARGER(dest: string) {
        this.write(`JUMP, HI ${dest}`);
    }

    JMP_SMALLER(dest: string) {
        this.write(`JUMP, LO ${dest}`);
    }

    JMP(dest: string) {
        this.write(`JUMP ${dest}`);
    }

    LABEL(name: string) {
        this.write(`${name}:`);
    }
}

export class Compiler {
    constructor(public symbol_table: SymbolTable, public assembly: Assembly) {

    }

    compile(node: ASTNode, stackframe: StackFrame): void {
        if(node.type == 'statements') {
            if(!node.generatedScope) {
                throw new Error(`Can't compile statents because no scope was generated for it.`);
            }
            if(!node.generatedScope.stackframe) {
                throw new Error(`Can't compile statement because no stack frame was generated for it.`);
            }
            this.assembly.setupStackframe(node.generatedScope.stackframe);
            let lastRet: RuntimeType | null = null;
            for(const stmt of node.statements) {
                if(lastRet) {
                    this.assembly.fixStackUnpush(getTypeSizeBytes(lastRet));
                }
                this.compile(stmt, node.generatedScope.stackframe);
                lastRet = stmt.runtimeType;
            }
            if(lastRet) {
                let size = getTypeSizeBytes(lastRet);
                if(size != 0) {
                    // TODO:
                    throw new Error(`Unsupported return value for statements`);
                }
            }
            this.assembly.cleanStackframe(node.generatedScope.stackframe);
        } else if(node.type == 'var_decl') {
            if(!node.generatedScope) {
                throw new Error(`Can't compile variable declaration because no scope was assigned to the node ${node}`);
            }
            if(node.value) {
                this.compile(node.value, stackframe);
            }
            this.assembly.POP("A");
            this.assembly.saveVariable(node.generatedScope.path, stackframe, 0, "A");
        } else if(node.type == 'bin_add') {
            if(node.left.runtimeType != RUNTIME_UINT8 || node.right.runtimeType != RUNTIME_UINT8) {
                throw new Error(`UNIMPLEMENTED: Can only compile addition of uint8 numbers`);
            }
            this.compile(node.left, stackframe);
            this.compile(node.right, stackframe);
            this.assembly.POP("A");
            this.assembly.POP("B");
            this.assembly.ADD("B", "A");
            this.assembly.PUSH("A");
        } else if(node.type == 'bin_sub') {
            if(node.left.runtimeType != RUNTIME_UINT8 || node.right.runtimeType != RUNTIME_UINT8) {
                throw new Error(`UNIMPLEMENTED: Can only compile subtraction of uint8 numbers`);
            }
            this.compile(node.left, stackframe);
            this.compile(node.right, stackframe);
            this.assembly.POP("A"); // right
            this.assembly.POP("B"); // left
            this.assembly.SUB("A", "B"); // left - right
            this.assembly.PUSH("B");
        } else if(node.type == 'integer') {
            if(node.runtimeType != RUNTIME_UINT8) {
                throw new Error(`UNIMPLEMENTED: Only uint8 is supported, got ${node.runtimeType}`);
            }
            this.assembly.MOV(this.assembly.integer(Number(node.value)), "A");
            this.assembly.PUSH("A");
        } else if(node.type == 'symbol') {
            if(node.runtimeType != RUNTIME_UINT8) {
                throw new Error(`UNIMPLEMENTED: Only uint8 is supported, got ${node.runtimeType}`);
            }
            if(!node.resolvedSymbol) {
                throw new Error(`Can't compile variable read because no scope was assigned to the variable ${node}`);
            }
            this.assembly.readVariable(node.resolvedSymbol.path, stackframe, 0, "A");
            this.assembly.PUSH("A");
        } else if(node.type == 'if_else') {
            if(node.condition.runtimeType != RUNTIME_UINT8) {
                throw new Error(`UNIMPLEMENTED: Only uint8 is supported for if/else conditions, got ${node.runtimeType}`);
            }
            this.compile(node.condition, stackframe);
            this.assembly.POP("A");
            this.assembly.CMP(this.assembly.integer(0), "A");
            const else_branch_label = this.assembly.nextLabel("ELSE");
            const end_if_label = this.assembly.nextLabel("END_IF");
            this.assembly.JMP_EQ(node.else_branch ? else_branch_label : end_if_label);
            this.compile(node.if_branch, stackframe);
            if(node.else_branch) {
                this.assembly.JMP(end_if_label);
                this.assembly.LABEL(else_branch_label);
                this.compile(node.else_branch, stackframe);
            }
            this.assembly.LABEL(end_if_label);
        } else if(node.type == 'native_type') {
            return;
        } else {
            throw new Error(`dolphin/compiler/Compiler.compile(): Unknown node type '${(node as any).type}'`);
        }
    }
}