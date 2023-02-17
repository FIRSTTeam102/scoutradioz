import type { Utilities } from 'scoutradioz-utilities';
import type { Upload, TeamKey, OrgKey } from 'scoutradioz-types';
export declare class UploadHelper {
    /**
     * MDH must be provided an already-configured scoutradioz-utilities DB module in order to function.
     * @param {Utilities} utilitiesModule
     */
    static config(utilitiesModule: Utilities): void;
    /**
     * Find upload links for a given team.
     * @param {string} orgKey org_key
     * @param {number} year year
     * @param {string} teamKey team_key
     * @returns {ImageLinks} Links to images
     */
    static findTeamImages(orgKey: OrgKey, year: number, teamKey: TeamKey): Promise<TeamImages>;
    /**
     * Return ImageLinks from an upload object.
     * @param {object} upload Upload object from database.
     * @returns {ImageLinks} Links to images
     */
    static getLinks(upload: Upload): ImageLinks;
    /**
     * Find upload links for a given team.
     * @param {string} orgKey org_key
     * @param {number} year year
     * @param {array} teamKeys Array of team_keys
     * @returns {ImageLinks[]} Links to images
     */
    static findTeamImagesMultiple(orgKey: OrgKey, year: number, teamKeys: TeamKey[]): Promise<TeamImages[]>;
}
export default UploadHelper;
export interface ImageLinks {
    sm?: string;
    md?: string;
    lg?: string;
}
export interface TeamImages {
    [key: string]: ImageLinks;
}
