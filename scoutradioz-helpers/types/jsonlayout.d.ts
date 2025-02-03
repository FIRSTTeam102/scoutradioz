import type { SprCalculation, SchemaItem } from 'scoutradioz-types';
export declare function validateSprLayout(sprLayout: SprCalculation): SprCalculation;
export declare function validateJSONLayout(layout: SchemaItem[]): {
    warnings: string[];
    layout: SchemaItem[];
};
