export interface Stream<T> {
    hasNext(): boolean;
    next(): T | undefined;
    [key: string]: any;
};

export interface Collector<T, U, V> {
    accumulator: U;
    collect(value: T): void;
    ret(): V;
};

export function limit<T>(stream: Stream<T>, max: number): Stream<T> {
    return {
        i: 0,
        max: max,
        stream: stream,
        hasNext() {
            return this.i < this.max && this.stream.hasNext();
        },
        next() {
            if(this.i >= this.max) {
                return;
            }
            this.i++;
            return this.stream.next();
        },
    };
}

export function map<T, U>(stream: Stream<T>, mapper: (value: T) => U): Stream<U> {
    return {
        stream: stream,
        mapper: mapper,
        hasNext() {
            return this.stream.hasNext();
        },
        next() {
            if(!this.hasNext()) {
                return undefined;
            }
            return this.mapper(this.stream.next() as T);
        }
    };
}

export function filter<T>(stream: Stream<T>, predicate: (value: T) => boolean): Stream<T> {
    return {
        stream: stream,
        predicate: predicate,
        next_: null,
        hasNext() {
            if(this.next_) return true;
            this.next_ = this.getNext();
            return this.next_ != null;
        },
        getNext() {
            if(this.next_) {
                const v = this.next_;
                this.next_ = null;
                return v;
            }
            while(this.stream.hasNext()) {
                const v = this.stream.next();
                if(this.predicate(v)) {
                    return {
                        value: v
                    };
                }
            }
            return null;
        },
        next() {
            return this.getNext().value;
        }
    } as Stream<T>;
}

export function collect<T, U, V>(stream: Stream<T>, collector: Collector<T, U, V>): V {
    while(stream.hasNext()) {
        collector.collect(stream.next() as T);
    }
    return collector.ret();
}

export function iterate<T>(array: T[]): Stream<T> {
    return {
        array: array,
        index: 0,
        hasNext() {
            return this.array.length > this.index;
        },
        next() {
            const c = this.array[this.index];
            this.index++;
            return c;
        }
    };
}

export function combine<T>(...streams: Stream<T>[]): Stream<T> {
    return {
        streams: streams,
        stream: 0,
        hasNext() {
            while(!this.streams[this.stream].hasNext()) {
                this.stream++;
                if(this.stream >= this.streams.length) {
                    return false;
                }
            }
            return true;
        },
        next() {
            this.hasNext();
            return this.streams[this.stream]?.next();
        }
    };
}

export function charsOfString(str: string): Stream<string> {
    return {
        str: str,
        index: 0,
        hasNext() {
            return this.str.length > this.index;
        },
        next() {
            const c = this.str[this.index];
            this.index++;
            return c;
        }
    };
}

export interface CancelableStream<T> extends Stream<T> {
    cancel(value: T): void;
    peek(): T | undefined;
}

export class CancelableStreamImpl<T> implements CancelableStream<T> {
    array: T[];
    
    constructor(private readonly stream: Stream<T>) {
        this.array = [];
    }
    
    hasNext(): boolean {
        return this.array.length > 0 || this.stream.hasNext();
    }

    next(): T | undefined {
        if(this.array.length > 0) {
            return this.array.pop() as T;
        }
        return this.stream.next();
    }

    cancel(value: T): void {
        this.array.push(value);
    }

    peek(): T | undefined {
        if(this.array.length > 0) {
            return this.array[this.array.length - 1];
        }
        const v = this.next();
        this.cancel(v as any);
        return v;
    }

    static of<T>(stream: Stream<T>): CancelableStream<T> {
        return new CancelableStreamImpl(stream);
    }
}

export function cancelableOf<T>(stream: Stream<T>): CancelableStream<T> {
    return CancelableStreamImpl.of(stream);
}