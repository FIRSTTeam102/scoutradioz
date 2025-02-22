import type { Utilities } from 'scoutradioz-utilities';
import type { Upload, TeamKey, OrgKey } from 'scoutradioz-types';
export declare class UploadHelper {
    /**
     * MDH must be provided an already-configured scoutradioz-utilities DB module in order to function.
     * @param {Utilities} utilitiesModule
     */
    static config(utilitiesModule: Utilities): void;
    /**
     * Find both orgImages (for inside of a form) and robot photos (from pit scouting), intended for Voyager syncing
     */
    static findImagesForYear(org_key: OrgKey, year: number): Promise<(Upload & {
        links: ImageLinks;
    })[]>;
    /**
     * Find upload links for a given team.
     * @param org_key org_key
     * @param year year
     * @returns Links to images
     */
    static findOrgImages(org_key: OrgKey, year: number): Promise<ObjectDict>;
    /**
     * Find upload links for a given team.
     * @param org_key org_key
     * @param year year
     * @param team_key team_key
     * @returns Links to images
     */
    static findTeamImages(org_key: OrgKey, year: number, team_key: TeamKey): Promise<TeamImages>;
    /**
     * Return ImageLinks from an upload object.
     * @param {object} upload Upload object from database.
     * @returns {ImageLinks} Links to images
     */
    static getLinks(upload: Upload): ImageLinks;
    /**
     * Find upload links for a given team.
     * @param {string} org_key org_key
     * @param {number} year year
     * @param {array} teamKeys Array of team_keys
     * @returns {ImageLinks[]} Links to images
     */
    static findTeamImagesMultiple(org_key: OrgKey, year: number, teamKeys: TeamKey[]): Promise<TeamImages[]>;
}
export default UploadHelper;
export interface ImageLinks {
    sm: string;
    md: string;
    lg: string;
}
export interface TeamImages {
    [key: string]: ImageLinks;
}
declare interface ObjectDict {
    [key: string]: object;
}
