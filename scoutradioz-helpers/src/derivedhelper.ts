import assert from 'assert';
import type { AnyDict } from 'scoutradioz-types';

export type ValueDict = { [key: string]: value };

export type value = string | number;
export type ValueStructure = Array<value | ValueStructure>;

export const validFuncs = ['min', 'max', 'log', 'abs', 'if', 'multiselect'];

// groups 1/2: operators, group 3: funcs & keywords, group 4: strings (for multiselect)
const regex = /(==|<=|>=|!=|\|\|)|([\-*+\^/()><,])|([\w.]+)|('.+?')/g;

export  class DerivedCalculator {
	values: ValueDict;
	constructor(values: ValueDict) {
		this.values = values;
	}

	parseValue(val: value, allowString = false): value {
		if (typeof val === 'number') return val;
		// otherwise, val is string
		if (val === 'true') return 1;
		if (val === 'false') return 0;
		let parsed = parseFloat(val);
		if (!isNaN(parsed)) return parsed;
		let fromDict = this.values[val];
		if (typeof fromDict === 'string' || typeof fromDict === 'number') return fromDict;
		// strings only allowed as args to multiselect and are surrounded by singlequotes
		if (allowString && typeof val === 'string' && val.startsWith('\'') && val.endsWith('\'')) return val.substring(1, val.length - 1);
		throw new TypeError('Could not parse value: ' + val);
	}
	evaluatePEMDASOp(arr: ValueStructure, ops: string[]) {
		let idx: number;
		while ((idx = arr.findIndex(val => ops.includes(val as string))) > 0) {
			let before = arr.slice(0, idx - 1);
			let thisOp = arr.slice(idx - 1, idx + 2);
			let after = arr.slice(idx + 2, arr.length);
			// console.log(before, thisOp, after);
			let thisVal = this.resolve(thisOp);
			// console.log(thisVal);
			arr = before.concat(thisVal, after);
			// arr = [...before, thisVal, ...after];
		}
		return arr;
	}

	// Parses args for evaluateFunctions. Warning: Mutates arr
	parseFunctionArgs(arr: ValueStructure) {
		let idx: number;
		let args: ValueStructure[] = [];
		arr.shift(); // Remove func from start of arr
		while ((idx = arr.indexOf(',')) > 0) {
			let thisArg = arr.slice(0, idx);
			// console.log('inside loop, thisarg=', thisArg, 'arr=', arr, 'idx=', idx);
			arr = arr.slice(idx + 1, arr.length);
			args.push(thisArg);
		}
		// arr should now have the remains after the last comma
		args.push(arr);
		// console.log('args=', args);
		return args;
	}

	// This is an array where we KNOW the first element is the function keyword and the rest of the array is the arguments
	evaluateFunction(func: string, args: ValueStructure[]) {
		switch (func) {
			case 'min': {
				assert(args.length === 2, new RangeError(`min(): Expected argument list to be 2 long; was ${args.length}`));
				let a = this.resolve(args[0]);
				let b = this.resolve(args[1]);
				let ret = Math.min(a, b);
				// console.log(`min(${a}, ${b}) = ${ret}`);
				return [ret];
			}
			case 'max': {
				assert(args.length === 2, new RangeError(`max(): Expected argument list to be 2 long; was ${args.length}`));
				let a = this.resolve(args[0]);
				let b = this.resolve(args[1]);
				let ret = Math.max(a, b);
				// console.log(`max(${a}, ${b}) = ${ret}`);
				return [ret];
			}
			case 'log': {
				assert(args.length === 2, new RangeError(`log(): Expected argument list to be 2 long; was ${args.length}`));
				let operand = this.resolve(args[0]);
				let base = this.resolve(args[1]);
				let ret = Math.log(operand) / Math.log(base);
				// console.log(`log(${operand}, ${base}) = ${ret}`);
				return [ret];
			}
			case 'abs': {
				assert(args.length === 1, new RangeError(`abs(): Expected argument list to be 1 long; was ${args.length}`));
				return [Math.abs(this.resolve(args[0]))];
			}
			case 'if': {
				assert(args.length % 2 == 1, new RangeError(`if(): Expected an odd number of arguments; was ${args.length}`));
				// if (cond1, ifTrue, ifFalse)
				// if (cond1, if1True, cond2, if2True, if2False)
				// if (cond1, if1True, cond2, if2True, cond3, if3True, if3False);
				for (let i = 0; i < args.length; i += 2) {
					// console.log('i=', i, args[i], args[i+1], args[i+2])
					let cond = this.resolve(args[i]);
					if (cond) return [this.resolve(args[i + 1])];
					else {
						// two cases: (1) we only have ifFalse left in array, so return ifFalse
						// 	and (2) we have another condition, so we continue in loop
						if (i + 3 === args.length) return [this.resolve(args[i + 2])]; // if this ifFalse is the last item, return it
						else continue; // this ifFalse is actually a condition, so continue in loop
					}
				}
				throw new Error('Should not have escaped loop for if() function! args=' + JSON.stringify(args));
			}
			case 'multiselect': {
				// multiselect(variable, value1, valueIfValue1, value2, valueIfValue2, etc.)
				// optional: default at end
				// multiselect is a bit locked down, only allowing hardcoded values, for simplicity

				assert(args.length >= 3, new RangeError(`multiselect(): Expected at least 3 arguments; was ${args.length}`));

				const rawArgs = args.map(arg => {
					assert(arg.length === 1 && typeof arg[0] === 'string', new RangeError(`multiselect args must include only hard-coded values, but ${JSON.stringify(arg)} includes some logic`));
					return arg[0];
				});
				let variable = rawArgs[0];
				assert(typeof variable === 'string', new TypeError(`Expected variable name as first argument in multiselect; found ${variable}`));
				let varValue = this.parseValue(variable, true); // get value for comparison, allowing strings
				if (typeof varValue === 'string') varValue = varValue.toLowerCase(); // for case insensitivity

				let defaultVal = NaN;
				if (rawArgs.length % 2 == 0) {
					let lastValue = this.parseValue(rawArgs.pop() as string);
					assert(typeof lastValue === 'number', new TypeError(`Expected default value of multiselect to be a number, but got string (${lastValue})`));
					defaultVal = lastValue;
				}
				for (let i = 1; i < rawArgs.length; i += 2) {
					let cmpValue = this.parseValue(rawArgs[i], true); // value to compare variableVal to
					if (typeof cmpValue === 'string') cmpValue = cmpValue.toLowerCase();
					let retValue = this.parseValue(rawArgs[i + 1]); // return value if comparison succeeds
					if (varValue === cmpValue) {
						return [retValue];
					}
				}
				return [defaultVal];
			}
			default:
				throw new Error(`Unrecognized function ${func}`);
		}
	}

	evaluateFunctions(arr: ValueStructure) {
		// if the start of the array is a function keyword, then process the rest of the array as the function's arguments
		let func = arr[0];
		if (typeof func === 'string' && validFuncs.includes(func)) {
			const args = this.parseFunctionArgs(arr);
			return this.evaluateFunction(func, args);
		}
		return arr;
	}

	tokenizeFormula(str: string) {
		return Array.from(str.matchAll(regex)).map(match => match[0]);
	}

	parseFormulaStructure(arr: string[]): ValueStructure {
		let ret: ValueStructure = [];

		// For simpler procesing later down the line, swap e.g. ["max", "("] into ["(", "max"] trust me bro
		for (let i = 0; i < arr.length; i++) {
			if (validFuncs.includes(arr[i])) {
				// console.log(i, arr[i], arr[i + 1]);
				let func = arr[i];
				if (arr[i + 1] !== '(') throw new SyntaxError(`Expected parenthesis after function keyword (${func}), found ${arr[i + 1]}`);
				arr[i + 1] = func;
				arr[i] = '(';
				i++; // since we just checked i and i+1, and since we modified i+1, we must not check i+1 so skip
			}
		}

		for (let i = 0; i < arr.length; i++) {
			let str = arr[i];
			// console.log('main loop', i, str);
			if (str === ')') {
				throw new Error(`Did not expect right parentheis at index ${i}, arr=${JSON.stringify(arr)}`);
			}
			else if (str === '(') {
				let [thisResult, newIdx] = findParenGroup(i + 1);
				ret.push(thisResult);
				i = newIdx;
			}
			else {
				ret.push(str);
			}
		}

		function findParenGroup(startIdx: number): [ValueStructure, number] {
			let subRet: ValueStructure = [];
			for (let i = startIdx; i < arr.length; i++) {
				let str = arr[i];
				// console.log('findParenGRoup', i, str, subRet);
				// base case return subRet
				if (str === ')') {
					// console.log('Returning', subRet);
					return [subRet, i];
				}
				else if (str === '(') {
					// console.log('Entering one down');
					let [thisResult, newIdx] = findParenGroup(i + 1);
					subRet.push(thisResult);
					i = newIdx;
				}
				else {
					subRet.push(str);
				}
			}
			throw new Error('Expected right parenthesis');
		}

		return ret;
	}

	// for the base cases, if a param is an array then resolve it into a value
	singleParamArrayToValue(param: value | ValueStructure) {
		if (Array.isArray(param)) return this.resolve(param);
		return this.parseValue(param);
	}

	resolve(arr: ValueStructure): number {
		// base case: 1 item in arr
		if (arr.length === 1) {
			let ret = this.singleParamArrayToValue(arr[0]);
			if (typeof ret !== 'number') throw new TypeError(`when arr.length === 1, expected singleParamArrayToValue() to return a number, but found ${typeof ret}! ret=${ret}`);
			return ret;
		}
		// base case: 3 items in arr, pemdas not needed
		if (arr.length === 3) {
			let a = this.singleParamArrayToValue(arr[0]);
			let op = arr[1];
			let b = this.singleParamArrayToValue(arr[2]);
			if (typeof a === 'string' || typeof b === 'string') throw new TypeError(`Expected a and b to be numbers! a=${a}, b=${b}`);
			switch (op) {
				case '*': return a * b;
				case '/': return (b === 0) ? 0 : a / b; // special case: div by zero returns zero
				case '+': return a + b;
				case '-': return a - b;
				case '>': return (a > b) ? 1 : 0;
				case '<': return (a < b) ? 1 : 0;
				case '==': return (a == b) ? 1 : 0;
				case '>=': return (a >= b) ? 1 : 0;
				case '<=': return (a <= b) ? 1 : 0;
				case '||': return a ? a : b;
				case '^': return Math.pow(a, b);
				default: throw new TypeError('Expected operator between a and b, found: ' + op);
			}
		}
		// Since parentheses were already parsed, we can now do functions and then pemdas
		arr = this.evaluateFunctions(arr);

		// no parentheses found and we are not at our base case of 1 or 3 items; evaluate pemdas
		arr = this.evaluatePEMDASOp(arr, ['^']);
		arr = this.evaluatePEMDASOp(arr, ['*', '/']);
		arr = this.evaluatePEMDASOp(arr, ['+', '-']);
		// theoretically, arr should now be 1 element long
		assert(arr.length === 1, new RangeError('arr is more than 1 element long: ' + JSON.stringify(arr)));
		let ret = this.singleParamArrayToValue(arr[0]);
		assert(typeof ret === 'number', new TypeError(`return value of resolve() is not a number! found ${typeof ret}, ret=${ret}`));
		return ret;
	}

	/**
	 * Tokenizes, parses, and resolves a formula. Saves result in cache for future derived operations and returns result.
	 * @param formula 
	 * @param id 
	 * @returns calculated value
	 */
	runFormula(formula: string, id: string) {
		let arr = this.tokenizeFormula(formula);
		let parsed = this.parseFormulaStructure(arr);
		let answer = this.resolve(parsed);
		this.values[id] = answer; // update values for future metrics that rely on this one
		return answer;
	}
}

export function convertValuesDict(dict: AnyDict) {
	let ret = {...dict} as ValueDict; // create copy
	for (let key in ret) {
		let val = ret[key];
		switch (typeof val) {
			case 'string':
			case 'number':
				break; // allow string and number
			case 'boolean':
				ret[key] = val ? 'true' : 'false'; // these will get parsed into 1 and 0 later in the pipe
				break;
			default:
				ret[key] = NaN; // null and undefined, as well as any other types
		}
	}
	return ret;
}