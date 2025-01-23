// This file is just some basic test cases for the derived helper.
import type { ValueDict } from './derivedhelper';
import { DerivedCalculator } from './derivedhelper';

const values: ValueDict = {
	teleopSpeaker: 10,
	teleopAmp: 2,
	autoSpeaker: 3,
	foo: 2,
	str: 'MyString',
};
let strs = [
	'teleopSpeaker*(5+3)-foo^6*3.1',
	'4.1+true-5^3-2/3/4',
	'6',
	'4258597.1-399',
	'12345+4^2',
	'(1+2      -(3)*4)-5+((12)-4)',
	'max(3, log(teleopSpeaker, 2)+2)+6',
	'if(3 > 4, 5, 6)',
	'if(3 > 4, 5, true, 7, 8)',
	'if(3 > 4, 5, false, 7, 4 >= 5, 8, 9)',
	'if(3 < 4, 5, 6)',
	'1.5 + multiselect(str, \'My String\', foo, \'MyStringg\', 696969.2 )'
];

let calc = new DerivedCalculator({
	onStageTimeStart: 10,
	onStageTimeEnd: 5,
	totalTeleopNotes: 0,
});
console.log(calc.runFormula('((135 - max(onStageTimeStart, onStageTimeEnd)) / totalTeleopNotes)', 'cycleTime'));