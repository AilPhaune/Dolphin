import { Collector } from "./stream";

export function toArray<T>(): Collector<T, T[], T[]> {
    return {
        accumulator: [],
        collect(value: T) {
            this.accumulator.push(value);
        },
        ret() {
            return this.accumulator;
        }
    };
}