import { getLogger } from "$lib/logger";
import type { LayoutField } from "$lib/types";
import type { FormSliderOptions, SchemaItem } from 'scoutradioz-types';

const logger = getLogger('ScoutingFormUtils');

export type FormData = {[key: string]: unknown};

// Svelte 5 is requiring defaults to be set in parents and not children, so this func is to create those defaults
export function initializeFormData(layout: SchemaItem[], formData: FormData = {}) {
	logger.debug('formData=', formData);
	for (let field of layout) {
		if ('id' in field) {
			switch(field.type) {
				case 'checkbox': {
					if (typeof formData[field.id] !== 'boolean') {
						logger.trace(`Setting ${field.id} default = false`);
						formData[field.id] = false;
					}
					break;
				}
				case 'counter': {
					if (typeof formData[field.id] !== 'number') {
						logger.trace(`Setting ${field.id} default = 0`);
						formData[field.id] = 0;
					}
					break;
				}
				case 'slider': {
					if (typeof formData[field.id] !== 'number') {
						let defaultValue = (field.options as FormSliderOptions).min
						logger.trace(`Setting ${field.id} default = ${defaultValue}`);
						formData[field.id] = defaultValue;
					}
					break;
				}
				case 'multiselect': {
					// testing for eq undefined instead of not string, in case someone puts a number in their formlayout
					if (typeof formData[field.id] === 'undefined') {
						// Multiselect.svelte adds '' as the first option
						logger.trace(`Setting ${field.id} default = ''`);
						formData[field.id] = '';
					}
					break;
				}
				case 'textblock': {
					if (typeof formData[field.id] !== 'string') {
						logger.trace(`Setting ${field.id} default = ''`);
						formData[field.id] = '';
					}
					break;
				}
			}
		}
	}
	
	return formData;
}