import type { AnyDict } from 'scoutradioz-types';
export type ValueDict = {
    [key: string]: value;
};
export type value = string | number;
export type ValueStructure = Array<value | ValueStructure>;
export declare const validFuncs: string[];
export declare class DerivedCalculator {
    values: ValueDict;
    constructor(values: ValueDict);
    parseValue(val: value, allowString?: boolean): value;
    evaluatePEMDASOp(arr: ValueStructure, ops: string[]): ValueStructure;
    parseFunctionArgs(arr: ValueStructure): ValueStructure[];
    evaluateFunction(func: string, args: ValueStructure[]): value[];
    evaluateFunctions(arr: ValueStructure): ValueStructure;
    tokenizeFormula(str: string): string[];
    parseFormulaStructure(arr: string[]): ValueStructure;
    singleParamArrayToValue(param: value | ValueStructure): value;
    resolve(arr: ValueStructure): number;
    /**
     * Tokenizes, parses, and resolves a formula. Saves result in cache for future derived operations and returns result.
     * @param formula
     * @param id
     * @returns calculated value
     */
    runFormula(formula: string, id: string): {
        answer: number;
        tokenize: number;
        parse: number;
        resolve: number;
    };
}
export declare function convertValuesDict(dict: AnyDict): ValueDict;
