import type { SprCalculation, SchemaItem } from 'scoutradioz-types';
export declare function validateSprLayout(sprLayout: SprCalculation, layout: SchemaItem[]): SprCalculation;
export declare function validateJSONLayout(layout: SchemaItem[], orgImageKeys: string[]): {
    warnings: string[];
    layout: SchemaItem[];
};
