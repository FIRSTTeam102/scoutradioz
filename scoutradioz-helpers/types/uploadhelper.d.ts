import { Utilities, Upload, TeamKey, OrgKey } from '@firstteam102/scoutradioz-utilities';
export declare class UploadHelper {
    /**
     * MDH must be provided an already-configured scoutradioz-utilities DB module in order to function.
     * @param {Utilities} utilitiesModule
     */
    config(utilitiesModule: Utilities): void;
    /**
     * Find upload links for a given team.
     * @param {string} orgKey org_key
     * @param {number} year year
     * @param {string} teamKey team_key
     * @returns {ImageLinks} Links to images
     */
    findTeamImages(orgKey: OrgKey, year: number, teamKey: TeamKey): Promise<TeamImages>;
    /**
     * Return ImageLinks from an upload object.
     * @param {object} upload Upload object from database.
     * @returns {ImageLinks} Links to images
     */
    getLinks(upload: Upload): ImageLinks;
    /**
     * Find upload links for a given team.
     * @param {string} orgKey org_key
     * @param {number} year year
     * @param {array} teamKeys Array of team_keys
     * @returns {ImageLinks[]} Links to images
     */
    findTeamImagesMultiple(orgKey: OrgKey, year: number, teamKeys: TeamKey[]): Promise<TeamImages[]>;
}
export interface ImageLinks {
    sm?: string;
    md?: string;
    lg?: string;
}
export interface TeamImages {
    [key: string]: ImageLinks;
}
