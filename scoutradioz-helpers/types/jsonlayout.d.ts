import type { SprCalculation, SchemaItem } from 'scoutradioz-types';
export declare function validateSprLayout(sprLayout: SprCalculation, layout: SchemaItem[]): SprCalculation;
export declare function validateJSONLayout(layout: SchemaItem[]): {
    warnings: string[];
    layout: SchemaItem[];
};
