import assert from 'assert';
import type { SprCalculation, CheckBoxItem, CounterItem, DerivedItem, DerivedItemLegacy, HeaderItem, LayoutEdit, MatchFormData, MultiselectItem, SchemaItem, SliderItem, ImageItem, SpacerItem, StringDict, SubheaderItem, TextBlockItem, ImportDataItem } from 'scoutradioz-types';
import { convertValuesDict, DerivedCalculator } from './derivedhelper.js';

const validTypes = ['checkbox', 'counter', 'slider', 'multiselect', 'textblock', 'header', 'subheader', 'spacer', 'derived', 'image', 'importdata'];

export function validateSprLayout(sprLayout: SprCalculation, layout: SchemaItem[]) {
	assert(sprLayout.points_per_robot_metric, 'SPR calculation must have "points\\_per\\_robot\\_metric" which refers to the ID of a field in your match form schema');
	let foundMatchingMetric = false;
	for (let item of layout) {
		// @ts-ignore
		if (item.id && item.id === sprLayout.points_per_robot_metric) {
			foundMatchingMetric = true;
			break;
		}
	}
	assert(foundMatchingMetric, 
		new Error(`SPR calculation points\\_per\\_robot\\_metric '${sprLayout.points_per_robot_metric}' does not match any field in your match form schema. SPR calculations will be disabled.`,
			{cause: 'points_per_robot_metric_no_match'} // to track this specific error
		)
	);

	assert(sprLayout.subtract_points_from_FRC, 'SPR calculation must have "subtract\\_points\\_from\\_FRC" object which refers to fields in the FRC alliance score schema');
	//assert(typeof sprLayout.subtract_points_from_FRC === 'object' && !Array.isArray(sprLayout.subtract_points_from_FRC) && sprLayout.subtract_points_from_FRC !== null, 'SPR calculation "subtract_points_from_FRC" must be an object of {string}: {number} pairs, where the strings refer to fields in the FRC alliance score schema');
	let subtractPoints = sprLayout.subtract_points_from_FRC;
	for (let thisKey of Object.keys(subtractPoints)) {
		let thisMultiplier = subtractPoints[thisKey];
		assert(typeof thisMultiplier === 'number', `SPR subtract-from field '${thisKey}' should be a number`);
	}

	return sprLayout;
}

export function validateJSONLayout(layout: SchemaItem[], orgImageKeys: string[]) {
	assert(Array.isArray(layout), 'Expected JSON input to be an array');

	let existingIds = new Set<string>();
	let warnings = new Set<string>();
	let testData: MatchFormData = {};

	for (let i in layout) {
		let item = layout[i];
		try {
			validateLayoutItem(item);
		}
		catch (err) {
			throw new Error(`Issue with item #${i}: ${err}.\nRelevant item: ${JSON.stringify(item)}`, { cause: i });
		}
	}
	// after forming the testdata object, attempt to calculate derived metrics
	let calculator = new DerivedCalculator(convertValuesDict(testData));
	for (let i = 0; i < layout.length; i++) {
		let item = layout[i];
		if (item.type === 'derived' && 'formula' in item) {
			try {
				let { answer: calculatedValue } = calculator.runFormula(item.formula, item.id);
				if (isNaN(calculatedValue)) {
					throw new Error('Resulting value is NaN!');
				}
			}
			catch (err) {
				if (err instanceof TypeError && 'cause' in err) {
					let variableName = err.cause as string;
					// Search for derived metrics later in the list with this variable name
					for (let j = i; j < layout.length; j++) {
						let futureItem = layout[j];
						// If we find a derived with a matching name later in the list, provide a custom error
						if (futureItem.type === 'derived' && futureItem.id === variableName) {
							throw new Error(`Issue with item #${i} with id ${item.id}: Formula relies on derived metric '${variableName}' which exists later in the list. Derived metrics get evaluated in order. Place ${item.id} after ${variableName} for it to evaluate correctly.`, { cause: i });
						}
					}
				}
				throw new Error(`Issue with item #${i} with id ${item.id}: Invalid formula: "${item.formula}". ${err}`, { cause: i });
			}
		}
	}

	return { warnings: Array.from(warnings), layout };

	function validateLayoutItem(item: SchemaItem) {

		// Transform legacy variants
		// @ts-ignore
		if (item.type === 'h2') { item.type = 'header'; warnings.add('Replaced instances of "h2" with "header"'); }
		// @ts-ignore
		if (item.type === 'h3') { item.type = 'subheader'; warnings.add('Replaced instances of "h3" with "subheader"'); }
		// @ts-ignore
		if (item.type === 'badcounter') { item.type = 'counter'; item.variant = 'bad'; item.allow_negative = false; warnings.add('Replaced instances of "badcounter" with "counter" w/ variant = "bad"'); }
		// @ts-ignore
		if (item.type === 'counterallownegative') { item.type = 'counter'; item.variant = 'standard'; item.allow_negative = true; warnings.add('Replaced instances of "counterallownegative" with "counter" w/ variant = "standard" and allow_negative = true'); }
		// @ts-ignore
		if (item.type === 'timeslider') { item.type = 'slider'; item.variant = 'time'; warnings.add('Replaced instances of "timeslider" with "slider" w/ variant = "time"'); }

		switch (item.type) {
			case 'header':
			case 'subheader':
				validateHeaderSubheader(item);
				break;
			case 'spacer':
				validateSpacer(item);
				break;
			case 'checkbox':
				validateCheckbox(item);
				testData[item.id] = 0;
				break;
			case 'counter':
				validateCounter(item);
				testData[item.id] = 0;
				break;
			case 'slider':
				validateSlider(item);
				testData[item.id] = item.options.min;
				break;
			case 'multiselect':
				validateMultiselect(item);
				testData[item.id] = item.options[0];
				break;
			case 'textblock':
				validateTextBlock(item);
				testData[item.id] = '';
				break;
			case 'derived':
				validateDerived(item);
				break;
			case 'image':
				validateImage(item, orgImageKeys);
				break;
			case 'importdata':
				validateImportData(item);
				break;
			default:
				// @ts-ignore
				throw new TypeError(`Unexpected item.type ${item.type} - must be one of ${validTypes.join(', ')}`);
		}

	}

	function validateSlider(item: SliderItem) {
		// options must be an object
		checkExpectedKeys(item, ['type', 'id', 'label', 'options', 'variant'], false);
		checkStringKeys(item, ['type', 'id', 'label', 'variant']);
		assert(typeof item.options === 'object', new TypeError('\'options\' field must be object, with min, max, and step!'));
		checkExpectedKeys(item.options, ['min', 'max', 'step'], false);
		assert(typeof item.options.max === 'number' &&
			typeof item.options.max === 'number' &&
			typeof item.options.step === 'number', new TypeError('\'options\' field must contain numeric min, max, and step values!'));
		checkId(item);
	}

	function validateMultiselect(item: MultiselectItem) {
		checkExpectedKeys(item, ['type', 'id', 'label', 'options'], false);
		checkStringKeys(item, ['type', 'id', 'label']);

		assert(Array.isArray(item.options), new TypeError('\'options\' field must be an array of strings!'));
		item.options.forEach(option => assert(typeof option === 'string', new TypeError(`Each option in 'options' must be a string, found ${typeof option}`)));
		checkId(item);
	}

	function validateDerived(item: DerivedItem | DerivedItemLegacy) {
		// since display_as is optional, here's some hackery
		let display_as = item.display_as;
		if (!item.display_as) {
			item.display_as = 'number';
		}

		assert(['number', 'percentage'].includes(item.display_as), new TypeError(`'display_as' must be either 'number' or 'percentage', found ${item.display_as}`));

		// quietly remove label when it's not necessary/allowed
		if ('label' in item) {
			delete item.label;
		}
		if ('formula' in item) {
			checkExpectedKeys(item, ['type', 'id', 'formula', 'display_as'], true);
		}
		else if ('operations' in item) {
			checkExpectedKeys(item, ['type', 'id', 'operations', 'display_as'], false);
			checkStringKeys(item, ['type', 'id']);
			assert(Array.isArray(item.operations), new TypeError('If provided, \'operations\' field must be an array!'));
			warnings.add('Detected at least one derived metric with the old "operations" format. This schema does not have any validation. Upgrade to the "formula" format for a much easier experience, plus automatic checking of syntax & formula validity. e.g.: "formula": "2 * teleopSpeaker + 5*teleopAmpSpeaker + teleopAmp"');
		}
		else {
			throw new TypeError('Derived metrics must have either a string "formula" or an array "operations".');
		}

		// remove temporary 'display_as'
		if (!display_as) {
			delete item.display_as;
		}

		checkId(item);
	}

	function validateCounter(item: CounterItem) {
		// Quietly add defaults for new fields
		if (typeof item.allow_negative !== 'boolean') {
			if (item.allow_negative === 'true') item.allow_negative = true;
			else if (item.allow_negative === 'false') item.allow_negative = false;
			else item.allow_negative = false;
		}
		if (typeof item.variant !== 'string') {
			item.variant = 'standard';
		}
		if (!['standard', 'bad'].includes(item.variant)) {
			throw new Error(`Unexpected value for counter variant. Expected 'standard' or 'bad', found '${item.variant}'`);
		}
		checkExpectedKeys(item, ['type', 'id', 'label', 'allow_negative', 'variant'], false);
		// since allow_negative should be boolean, check string keys only
		checkStringKeys(item, ['type', 'id', 'label', 'variant']);
		checkId(item);
	}

	function validateTextBlock(item: TextBlockItem) {
		checkExpectedKeys(item, ['type', 'id', 'label'], true);
		checkId(item);
	}

	function validateCheckbox(item: CheckBoxItem) {
		checkExpectedKeys(item, ['type', 'id', 'label'], true);
		checkId(item);
	}

	function validateSpacer(item: SpacerItem) {
		// Quietly remove item.id when it's not necessary
		if ('id' in item) {
			delete item.id;
		}
		checkExpectedKeys(item, ['type'], true);
	}

	function validateHeaderSubheader(item: HeaderItem | SubheaderItem) {
		// Quietly remove item.id when it's not necessary
		if ('id' in item) {
			delete item.id;
		}
		checkExpectedKeys(item, ['type', 'label'], true);
	}

	function validateImage(item: ImageItem, orgImageKeys: string[]) {
		checkExpectedKeys(item, ['type', 'image_id'], true);
		assert(orgImageKeys.includes(item.image_id), `Image ID ${item.image_id} not found in organization images`);
	}

	function validateImportData(item: ImportDataItem) {
		checkExpectedKeys(item, ['type', 'datafields'], true);
		// assert(orgImageKeys.includes(item.image_id), `Image ID ${item.image_id} not found in organization images`);
	}

	function checkId(item: { id: string }) {
		assert(!existingIds.has(item.id), `Duplicate ID ${item.id}`);
		existingIds.add(item.id);
	}

	// Check against a list of expected properties of the object, and report any new/missing properties.
	function checkExpectedKeys(item: any, keys: string[], shouldAllBeString: boolean) {
		let itemsKeys = new Set(Object.keys(item));
		let expectedKeys = new Set(keys);

		let missingKeys = expectedKeys.difference(itemsKeys);
		let unexpectedKeys = itemsKeys.difference(expectedKeys);

		assert(missingKeys.size === 0, `Missing key(s): ${Array.from(missingKeys).join(', ')}`);
		assert(unexpectedKeys.size === 0, `Unexpected key(s): ${Array.from(unexpectedKeys).join(', ')}`);

		// If all keys should be string, check it here since we provided the array anyways
		if (shouldAllBeString) checkStringKeys(item, keys);
	}

	// Check the provided list of keys to see if they are all strings.
	function checkStringKeys(item: any, keys: string[]) {
		for (let key of keys) {
			assert(typeof item[key] === 'string', new TypeError(`Property '${key}' should be string; found ${typeof item[key]}!`));
		}
	}
}