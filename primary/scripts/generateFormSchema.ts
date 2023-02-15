#!/usr/bin/env ts-node

import { resolve, dirname } from 'path';
import { writeFileSync } from 'fs';
import * as TJS from 'typescript-json-schema';

import type { Layout } from '@firstteam102/scoutradioz-types';

// see cleanup done in /manage/orgconfig/submitform
type NonEditFields = 'form_type' | 'org_key' | 'year' | 'order' | '_id';
type EditLayout<T> = Omit<T, NonEditFields>;
// distributes to each layout
type LayoutDistributor<T> = T extends any ? EditLayout<T> : never;

/** An array of question/metrics for the pit or match scouting form. */
export declare type FormSchema = (LayoutDistributor<Layout> & {
	// https://github.com/microsoft/vscode-json-languageservice/issues/86
	// this makes all of the types show up, but still only allows the right properties per type
	type: Layout['type'];
})[];

// where to find the type (here)
const typesFile = resolve('./generateFormSchema.ts');
const layoutType = 'FormSchema';

const settings: TJS.PartialArgs = {
	ref: true,
	required: true,
};
const compilerOptions: TJS.CompilerOptions = {};

const program = TJS.getProgramFromFiles([typesFile], compilerOptions, dirname(typesFile));
const schema = TJS.generateSchema(program, layoutType, settings);

writeFileSync('../public/formSchema.json', JSON.stringify(schema, null, '\t'));
