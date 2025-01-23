import type { Utilities } from 'scoutradioz-utilities';
import upload from './uploadhelper';
import matchData from './matchdatahelper';
export declare class Helpers {
    static upload: typeof upload;
    static matchData: typeof matchData;
    /**
     * Required:
     * @param {object} utilities Already-configured scoutradioz-utilities module
     */
    static config: (utilities: Utilities) => void;
}
export default Helpers;
export { default as upload } from './uploadhelper';
export { default as matchData } from './matchdatahelper';
export * from './derivedhelper';
