import { RUNTIME_UINT8, RuntimeType, areTypesEqual, getTypeSizeBytes } from "../../analysis/rt_type";
import { StackFrame } from "../../analysis/stack_frame";
import { SymbolTable } from "../../analysis/symbol_table";
import { AsmCommandNode } from "../../ast/asm";
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
        if(value.includes('\n')) {
            const values = value.split('\n');
            for(const v of values) {
                this.write(v);
            }
            return;
        }
        if(!value.includes(':')) {
            this.output += '    '; // 4 space indentation if it's not a label
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

    character(value: string): string {
        return `#${value.charCodeAt(0)}`;
    }

    hex(value: string) {
        return `H'${value}`;
    }

    setupStackframe(frame: StackFrame) {
        this.SUB(this.integer(frame.sizeBytes), 'SP');
        this.stack.push(0);
    }

    cleanStackframe(frame: StackFrame) {
        this.ADD(this.integer(frame.sizeBytes), 'SP');
        this.stack.pop();
    }

    findVar(name: string, frame: StackFrame) {
        let f;
        let frameOffset = 0;
        let i = 0;
        do {
            f = frame.find(name);
            i++;
            frameOffset += this.stack[this.stack.length - i];
            if(f) break;
            if(!frame.parentStackFrame) break;
            frameOffset += frame.sizeBytes;
            frame = frame.parentStackFrame;
            if(frame.scope.specialType == 'function') {
                // skip the return adress that is also present on the stack
                frameOffset += 2;
            }
        } while(true);
        
        if(!f) return null;

        return {
            sizeBytes: f.sizeBytes,
            ref: f.ref,
            index: f.index + frameOffset
        };
    }

    saveVariable(name: string, frame: StackFrame, offset: number, source: string) {
        const index = this.findVar(name, frame);
        if(!index) {
            throw new Error(`Variable ${name} not found`);
        }
        if(index.sizeBytes <= offset) {
            throw new Error(`Variable space overflow`);
        }
        this.MOV(source, this.stackIndex(index.index + offset));
    }

    readVariable(name: string, frame: StackFrame, offset: number, dest: string) {
        const index = this.findVar(name, frame);
        if(!index) {
            throw new Error(`Variable ${name} not found`);
        }
        if(index.sizeBytes <= offset) {
            throw new Error(`Variable space overflow`);
        }
        this.MOV(this.stackIndex(index.index + offset), dest);
    }

    stackIndex(index: number): string {
        return `{SP}+${index}`;
    }

    fixStackUnpush(bytes: number) {
        if(bytes == 0) return;
        this.ADD(this.integer(bytes), "SP");
        this.stack[this.stack.length - 1] -= bytes;
    }

    fixStackUnpushNoUpdateSP(bytes: number) {
        if(bytes == 0) return;
        this.stack[this.stack.length - 1] -= bytes;
    }

    fixStackPush(bytes: number) {
        if(bytes == 0) return;
        this.SUB(this.integer(bytes), "SP");
        this.stack[this.stack.length - 1] += bytes;
    }

    fixStackPushNoUpdateSP(bytes: number) {
        if(bytes == 0) return;
        this.stack[this.stack.length - 1] += bytes;
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
        if(["#0", "H'0", "H'00", "H'00"].includes(value)) {
            return;
        }
        this.write(`ADD ${value}, ${dest}`);
    }

    SUB(value: string, dest: string) {
        if(["#0", "H'0", "H'00", "H'00"].includes(value)) {
            return;
        }
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

    /**
     * Does the same as POP but doesn't pop the value
     */
    STACK_PEEK(dest: string, offset: number = 0) {
        if(this.pushPopWait) {
            const v = this.pushPopWait;
            this.pushPopWait = null;
            this.write(v);
        }
        this.MOV(this.stackIndex(offset), dest);
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

    CALL(adress: string) {
        this.write(`CALL ${adress}`);
    }

    RET() {
        this.write(`RET`);
    }
}

export const ASM_BLOCK_COMPILER_NAME = "dolphin";

export const FLAG_EXPERIMENTAL_STRINGS = "--experimental-strings";

export class Compiler {
    constructor(public symbol_table: SymbolTable, public assembly: Assembly, public readonly flags: string[] = []) {

    }

    getFlag(flag: string) {
        return this.flags.includes(flag);
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
            let size = 0;
            if(lastRet) {
                size = getTypeSizeBytes(lastRet);
                if(size != 0) {
                    if(node.runtimeType?.type == 'runtime_void') {
                        this.assembly.fixStackUnpush(size);
                        size = 0;
                    } else if(node.runtimeType && size == getTypeSizeBytes(node.runtimeType)) {
                        for(let i = size - 1; i >= 0; i--) {
                            this.assembly.MOV(this.assembly.stackIndex(i), 'A');
                            this.assembly.MOV('A', this.assembly.stackIndex(node.generatedScope.stackframe.sizeBytes + i));
                        }
                        this.assembly.fixStackUnpushNoUpdateSP(size);
                    } else {
                        throw new Error(`Invalid return type for statement`);
                    }
                }
            }
            this.assembly.cleanStackframe(node.generatedScope.stackframe);
            this.assembly.fixStackPushNoUpdateSP(size);
        } else if(node.type == 'var_decl') {
            if(!node.generatedScope) {
                throw new Error(`Can't compile variable declaration because no scope was assigned to the node ${node}`);
            }
            if(node.value) {
                if(!areTypesEqual(node.value.runtimeType, node.generatedScope.resolved_var_type)) {
                    throw new Error(`Can't assign ${JSON.stringify(node.runtimeType)} to ${JSON.stringify(node.generatedScope.resolved_var_type)}`);
                }
                this.compile(node.value, stackframe);
                this.assembly.POP("A");
                this.assembly.saveVariable(node.generatedScope.path, stackframe, 0, "A");
            }
        } else if(node.type == 'var_assign') {
            if(!node.resolvedVariable) {
                throw new Error(`Can't compile variable assignment because the variable ${node.name.name} couldn't be resolved`);
            }
            if(!areTypesEqual(node.runtimeType, node.resolvedVariable.resolved_var_type)) {
                throw new Error(`Can't assign ${JSON.stringify(node.runtimeType)} to ${JSON.stringify(node.resolvedVariable.resolved_var_type)}`);
            }
            this.compile(node.value, stackframe);
            this.assembly.POP("A");
            this.assembly.saveVariable(node.resolvedVariable.path, stackframe, 0, "A");
            this.assembly.PUSH("A");
        } else if(node.type == 'fun_decl') {
            if(!node.generatedScope) {
                throw new Error(`Scope for function ${node.name.name} not generated`);
            }
            const body = node.generatedScope.declaredBody;
            if(!body) {
                throw new Error(`Function ${node.name.name} never implemented`);
            }
            if(node.generatedScope.staticAdress) return;
            if(!node.generatedScope.stackframe) {
                throw new Error(`No stackframe generated for function ${node.name.name}`);
            }
            if(!body.runtimeType) {
                throw new Error(`Return type for function ${node.name.name} not resolved`);
            }
            const label = this.assembly.nextLabel(`FUNCTION_${node.name.name}`);
            const afterLabel = this.assembly.nextLabel(`END_FUNCTION_${node.name.name}`);
            node.generatedScope.staticAdress = label;
            this.assembly.JMP(afterLabel);
            this.assembly.LABEL(label);
            this.compile(body, stackframe);
            
            const retSize = getTypeSizeBytes(body.runtimeType);
            if(retSize > 0) {
                for(let i = retSize - 1; i >= 0; i--) {
                    this.assembly.MOV(this.assembly.stackIndex(i), 'A');
                    this.assembly.MOV('A', this.assembly.stackIndex(node.generatedScope.stackframe.sizeBytes + stackframe.sizeBytes + i + 2));
                }
                this.assembly.fixStackUnpush(retSize);
            }

            this.assembly.RET();
            this.assembly.LABEL(afterLabel);
        } else if(node.type == 'fun_call') {
            if(node.name.resolvedSymbol?.type != "scope" || node.name.resolvedSymbol.specialType != "function") {
                throw new Error(`Function ${node.name.name} not resolved`);
            }
            if(!node.name.resolvedSymbol.resolved_return_type) {
                throw new Error(`Return type of function ${node.name.name} has not been resolved`);
            }
            if(!node.name.resolvedSymbol.staticAdress) {
                throw new Error(`Function ${node.name.name} can't be called when not yet generated`);
            }
            if(!areTypesEqual(node.name.resolvedSymbol.resolved_return_type, node.runtimeType)) {
                throw new Error(`Unexpected error while compiling function call: node.runtimeType, ${node.name.resolvedSymbol.resolved_return_type} != ${node.runtimeType}`);
            }

            // Allocate stack space for return value
            const retValueSize = getTypeSizeBytes(node.name.resolvedSymbol.resolved_return_type);
            if(retValueSize > 0) {
                this.assembly.fixStackPush(retValueSize);
            }

            // Calculate the arguments
            if(node.args.length != node.name.resolvedSymbol.parameters.length) {
                throw new Error(`Function ${node.name.name} expects ${node.name.resolvedSymbol.parameters.length} arguments but was provided ${node.args.length}`);
            }
            let argsSize = 0;
            for(let i = 0; i < node.args.length; i++) {
                const arg = node.args[i];
                const paramName = node.name.resolvedSymbol.parameters[i];
                const param = node.name.resolvedSymbol.children[paramName];
                if(param.type != "variable") {
                    throw new Error(`Unexpected error while compiling function call: not a variable`);
                }
                if(!param.resolved_var_type) {
                    throw new Error(`The type of the '${paramName}' parameter couldn't be resolved`);
                }
                if(!areTypesEqual(param.resolved_var_type, arg.runtimeType)) {
                    throw new Error(`Parameter ${paramName} is of type ${param.resolved_var_type} but type ${arg.runtimeType} is provided`);
                }
                this.compile(arg, stackframe);
                argsSize += getTypeSizeBytes(param.resolved_var_type);
            }

            // Call the function
            this.assembly.CALL(node.name.resolvedSymbol.staticAdress.toString());

            // Remove arguments
            this.assembly.fixStackUnpush(argsSize);

            // The result of the function is now on the stack
        } else if(node.type == 'bin_add') {
            if(!areTypesEqual(node.left.runtimeType, RUNTIME_UINT8) || !areTypesEqual(node.right.runtimeType, RUNTIME_UINT8)) {
                throw new Error(`UNIMPLEMENTED: Can only compile addition of uint8 numbers`);
            }
            this.compile(node.left, stackframe);
            this.compile(node.right, stackframe);
            this.assembly.POP("A");
            this.assembly.POP("B");
            this.assembly.ADD("B", "A");
            this.assembly.PUSH("A");
        } else if(node.type == 'bin_sub') {
            if(!areTypesEqual(node.left.runtimeType, RUNTIME_UINT8) || !areTypesEqual(node.right.runtimeType, RUNTIME_UINT8)) {
                throw new Error(`UNIMPLEMENTED: Can only compile subtraction of uint8 numbers`);
            }
            this.compile(node.left, stackframe);
            this.compile(node.right, stackframe);
            this.assembly.POP("A"); // right
            this.assembly.POP("B"); // left
            this.assembly.SUB("A", "B"); // left - right
            this.assembly.PUSH("B");
        } else if(node.type == 'integer') {
            if(!areTypesEqual(node.runtimeType, RUNTIME_UINT8)) {
                throw new Error(`UNIMPLEMENTED: Only uint8 is supported, got ${node.runtimeType}`);
            }
            this.assembly.MOV(this.assembly.integer(Number(node.value)), "A");
            this.assembly.PUSH("A");
        } else if(node.type == 'string') {
            if(!this.getFlag(FLAG_EXPERIMENTAL_STRINGS)) {
                throw new Error(`String support is experimental. Use flag ${FLAG_EXPERIMENTAL_STRINGS} if you wan't to use strings.`);
            }
            for(let i = node.value.length - 1; i >= 0; i--) {
                this.assembly.MOV(this.assembly.character(node.value[i]), "A");
                this.assembly.PUSH("A");
            }
        } else if(node.type == 'symbol') {
            if(!areTypesEqual(node.runtimeType, RUNTIME_UINT8)) {
                throw new Error(`UNIMPLEMENTED: Only uint8 is supported, got ${node.runtimeType}`);
            }
            if(!node.resolvedSymbol) {
                throw new Error(`Can't compile variable read because no scope was assigned to the variable ${node}`);
            }
            this.assembly.readVariable(node.resolvedSymbol.path, stackframe, 0, "A");
            this.assembly.PUSH("A");
        } else if(node.type == 'if_else') {
            if(!areTypesEqual(node.condition.runtimeType, RUNTIME_UINT8)) {
                throw new Error(`UNIMPLEMENTED: Only uint8 is supported for if/else conditions, got ${node.runtimeType}`);
            }
            const retTypeSize = node.runtimeType ? getTypeSizeBytes(node.runtimeType) : 0;
            this.compile(node.condition, stackframe);
            this.assembly.POP("A");
            this.assembly.CMP(this.assembly.integer(0), "A");
            const else_branch_label = this.assembly.nextLabel("ELSE");
            const end_if_label = this.assembly.nextLabel("END_IF");
            this.assembly.JMP_EQ(node.else_branch ? else_branch_label : end_if_label); // the condition is false
            this.compile(node.if_branch, stackframe);
            if(node.else_branch) {
                this.assembly.fixStackUnpushNoUpdateSP(retTypeSize);
                this.assembly.JMP(end_if_label);
                this.assembly.LABEL(else_branch_label);
                this.compile(node.else_branch, stackframe);
            }
            this.assembly.LABEL(end_if_label);
        } else if(node.type == 'while_loop') {
            if(!areTypesEqual(node.condition.runtimeType, RUNTIME_UINT8)) {
                throw new Error(`UNIMPLEMENTED: Only uint8 is supported for while loop conditions, got ${node.runtimeType}`);
            }
            const condition_label = this.assembly.nextLabel("WHILE_LOOP");
            const end_while_label = this.assembly.nextLabel("END_WHILE");
            if(node.loop_body.type == 'statements' && node.loop_body.generatedScope?.specialType == 'loop') {
                node.loop_body.generatedScope.jumpBreakLabel = end_while_label;
                node.loop_body.generatedScope.jumpContinueLabel = condition_label;
            }
            this.assembly.LABEL(condition_label);
            this.compile(node.condition, stackframe);
            this.assembly.POP("A");
            this.assembly.CMP(this.assembly.integer(0), "A");
            this.assembly.JMP_EQ(end_while_label); // the condition is false
            this.compile(node.loop_body, stackframe);
            this.assembly.JMP(condition_label);
            this.assembly.LABEL(end_while_label);
        } else if(node.type == 'break_loop' || node.type == 'continue_loop') {
            if(!node.loopScope) {
                throw new Error(`Can't compile '${node.type.replaceAll('_loop', '')}' node because it was not associated to any loop`);
            }
            let label: string | undefined;
            if(node.type == 'break_loop') {
                label = node.loopScope.jumpBreakLabel;
            } else if(node.type == 'continue_loop') {
                label = node.loopScope.jumpContinueLabel;
            } else {
                throw Error(`Invalid loop control`);
            }
            if(!label) {
                throw new Error(`Can't compile '${node.type.replaceAll('_loop', '')}' node because it was associated with didn't provide a jump label for the operation`);
            }
            this.assembly.JMP(label);
        } else if(node.type == 'assembly') {
            if(node.targets.includes(ASM_BLOCK_COMPILER_NAME)) {
                for(const inst of node.instructions) {
                    this.compile(inst, stackframe);
                }
            }
        } else if(node.type == 'asm_command') {
            if(node.command.value == "MOVE") {
                this.asmCommandMove(node, stackframe);
            } else if(node.command.value == "PUSH") {
                this.asmCommandPush(node, stackframe);
            } else if(node.command.value == "POP") {
                this.asmCommandPop(node, stackframe);
            } else if(node.command.value == "ADD") {
                this.asmCommandAddSub(node, stackframe, "ADD");
            } else if(node.command.value == "SUB") {
                this.asmCommandAddSub(node, stackframe, "SUB");
            } else {
                throw new Error(`Unknown assembly command ${node.command.value}`);
            }
        } else if(node.type == 'litteral_instruction') {
            if(/^(((\s*)(PUSH)|(POP))|((\s*)((MOVE)|(SUB)|(ADD))(\s+)(.*),(\s*)(SP)))/ig.test(node.value)) {
                throw new Error(`To avoid corrupting the stack, operations that modify it can only be done using the command, not in a litteral instruction`);
            }
            this.assembly.write(node.value);
        } else if(node.type == 'void_expr' || node.type == 'native_type') {
            return;
        } else {
            throw new Error(`dolphin/compiler/Compiler.compile(): Unknown node type '${(node as any).type}'`);
        }
    }

    private asmCommandAddSub(node: AsmCommandNode, stackframe: StackFrame, type: "ADD" | "SUB") {
        if(node.args.length != 2) {
            throw new Error(`Assembly command ${type} expects 2 arguments, got ${node.args.length}`);
        }
        const [value, dest] = node.args;
        let from: string;
        let pushedFrom = false;
        if(value.type == 'string') {
            if(!(["X", "Y", "A", "B"].includes(value.value))) {
                throw new Error(`Invalid register, valid registers are X, Y, A and B`);
            }
            from = value.value;
        } else {
            from = (dest.type == "string" && dest.value == "A") ? "B" : "A";
            this.assembly.PUSH(from);
            pushedFrom = true;
            if(from != 'A') {
                this.assembly.PUSH('A');
            }
            this.compile(value, stackframe);
            this.assembly.POP(from);
            if(from != 'A') {
                this.assembly.POP('A');
            }
        }
        if(dest.type == "string") {
            if(!(["X", "Y", "A", "B"].includes(dest.value))) {
                throw new Error(`Invalid register, valid registers are X, Y, A and B`);
            }
            this.assembly[type](from, dest.value);
        } else if(dest.type == "symbol") {
            if(!dest.runtimeType) {
                throw new Error(`Destination doesn't have a runtime type`);
            }
            if(!dest.resolvedSymbol) {
                throw new Error(`Destination couldn't be resolved`);
            }
            const size = getTypeSizeBytes(dest.runtimeType);
            if(size != 1) {
                throw new Error(`Assembly command ${type}: Only 1 byte variables supported, got ${size}`);
            }
            const to = from == "B" ? "A" : "B";
            this.assembly.PUSH(to);
            this.assembly.readVariable(dest.resolvedSymbol.path, stackframe, 0, to);
            this.assembly[type](from, to);
            this.assembly.saveVariable(dest.resolvedSymbol.path, stackframe, 0, to);
            this.assembly.POP(to);
        } else {
            throw new Error(`Assembly command ${type} expects second argument 'destination' to be either an output register or a variable, got ${dest.type}`);
        }
        if(pushedFrom) {
            this.assembly.POP(from);
        }
    }

    private asmCommandPush(node: AsmCommandNode, stackframe: StackFrame) {
        for(let i = 0; i < node.args.length; i++) {
            const arg = node.args[i];
            if(arg.type != "string") {
                this.compile(arg, stackframe);
                continue;
            }
            if(!(["X", "Y", "A", "B"].includes(arg.value))) {
                throw new Error(`Invalid register, valid registers are X, Y, A and B`);
            }
            this.assembly.PUSH(arg.value);
        }
    }

    private asmCommandPop(node: AsmCommandNode, stackframe: StackFrame) {
        for(let i = 0; i < node.args.length; i++) {
            const arg = node.args[i];
            if(arg.type != "string") {
                throw new Error(`Expected destination register as string, got ${arg.type}`);
            }
            if(!(["X", "Y", "A", "B"].includes(arg.value))) {
                throw new Error(`Invalid destination register, valid registers are X, Y, A and B`);
            }
            this.assembly.PUSH(arg.value);
        }
    }

    private asmCommandMove(node: AsmCommandNode, stackframe: StackFrame) {
        const [value, ...dests] = node.args;
        if(!value.runtimeType) {
            throw new Error(`Value to move doesn't have a runtime type`);
        }
        const valueSize = getTypeSizeBytes(value.runtimeType);
        if(valueSize <= 0 || valueSize > 4) {
            throw new Error(`Can only move a value with size between 1 and 4, got ${valueSize}`);
        }
        if(dests.length != 1) {
            throw new Error(`Invalid number of destination registers given (${dests.length - 1}), expected ${valueSize}`);
        }
        this.compile(value, stackframe);
        for(let i = 0; i < dests.length; i++) {
            const dest = dests[i];
            if(dest.type != "string") {
                throw new Error(`Expected destination register as string, got ${dest.type}`);
            }
            if(!(["X", "Y", "A", "B"].includes(dest.value))) {
                throw new Error(`Invalid destination register, valid registers are X, Y, A and B`);
            }
            this.assembly.POP(dest.value);
        }
    }
}