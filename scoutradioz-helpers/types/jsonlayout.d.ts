import type { ChartSections, SprCalculation, SchemaItem } from 'scoutradioz-types';
export declare function validateReportDefinitionLayout(layout: ChartSections): {
    warnings: never[];
    layout: ChartSections;
};
export declare function validateSprLayout(sprLayout: SprCalculation, layout: SchemaItem[]): SprCalculation;
export declare function validateJSONLayout(layout: SchemaItem[], orgImageKeys: string[]): {
    warnings: string[];
    layout: SchemaItem[];
};
