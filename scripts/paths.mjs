// Paths common across multiple helper scripts.

import path from 'path';
import { fileURLToPath } from 'url';

export const pathToRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const pathToPrimary = path.join(pathToRoot, 'primary');
export const pathToUpload = path.join(pathToRoot, 'upload');

export const pathToPublicSrc = path.join(pathToPrimary, 'public-src');
export const pathToLess = path.join(pathToPublicSrc, 'less');

export const pathToPublicCss = path.join(pathToPrimary, 'public', 'css');

export const pathToTs = path.join(pathToPublicSrc, 'ts');
export const pathToTsBundled = path.join(pathToPublicSrc, 'ts-bundled');
export const pathToPublicJs = path.join(pathToPrimary, 'public', 'js');