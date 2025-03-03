import type { MatchScouting, OrgKey, OrgSchema, PitScouting, Schema, ScoutingPair, User } from 'scoutradioz-types';
import type { Utilities } from 'scoutradioz-utilities';
import type { AnyBulkWriteOperation, ObjectId } from 'mongodb';
import assert from 'assert';

process.env.TIER = 'dev';

const utilities: Utilities = require('scoutradioz-utilities');

utilities.config(require('../databases.json'), {
    cache: {
        enable: true,
        maxAge: 30
    },
    debug: true,
});

// @ts-ignore
utilities.refreshTier();

(async () => {
    await utilities.remove('heatmapcolors', {});
    //insert anitial heat map colors
   await utilities.insert('heatmapcolors', { name: ' Default Red/Green', key: 'default', min: { r: 63, g: 0, b: 0 }, max: { r: 0, g: 214, b: 0 } })
   await utilities.insert('heatmapcolors', { name: 'Grayscale', key: 'grayscale', min: { r: 0, g: 0, b: 0 }, max: { r: 200, g: 200, b: 200 } })
   await utilities.insert('heatmapcolors', { name: 'Sunburst', key: 'sunburst', min: { r: 110, g: 8, b: 36 }, max: { r: 244, g: 179, b: 1 } })
   await utilities.insert('heatmapcolors', { name: 'City Night', key: 'citynight', min: { r: 41, g: 10, b: 73 }, max: { r: 163, g: 196, b: 40 } })
   await utilities.insert('heatmapcolors', { name: 'Inferno Twilight', key: 'infernotwilight', min: { r: 0, g: 0, b: 0 }, max: { r: 300, g: 100, b: 0 } })
   await utilities.insert('heatmapcolors', { name: 'Lochmara', key: 'lochmara', min: { r: 2, g: 41, b: 110 }, max: { r: 253, g: 179, b: 56 } })
   await utilities.insert('heatmapcolors', { name: 'Joker', key: 'joker', min: { r: 41, g: 94, b: 17 }, max: { r: 176, g: 18, b: 158 } })
   await utilities.insert('heatmapcolors', { name: 'Orple', key: 'orple', min: { r: 81, g: 40, b: 136 }, max: { r: 235, g: 97, b: 35 } })
   await utilities.insert('heatmapcolors', { name: 'Cotton Candy', key: 'cottoncandy', min: { r: 126, g: 41, b: 84 }, max: { r: 148, g: 203, b: 236 } })
   await utilities.insert('heatmapcolors', { name: 'Steamship', key: 'steamship', min: { r: 0, g: 0, b: 80 }, max: { r: 200, g: 200, b: 200 } })
   await utilities.insert('heatmapcolors', { name: 'Beach', key: 'beach', min: { r: 215, g: 150, b: 66 }, max: { r: 64, g: 176, b: 166 } })
   await utilities.insert('heatmapcolors', { name: 'Moraine', key: 'moraine', min: { r: 93, g: 41, b: 10 }, max: { r: 40, g: 183, b: 216 } })
    process.exit(0);
})();
// grayscale min(0,0,0), max(200,200,200)!
// default min(63,0,0),max(0,214,0)!
// blue to yellow min(2,81,150), max(253,179,56)!
// purple to orange min(81,40,136), max(235,97,35)!
// green to purple min(41,94,17), max(176,18,158)!
// brown to blue min(106,74,60), max(15,101,161)
// brick to yellow min(110,8,36), max(244,179,1)!
// tan to turquoise min(255,190,106), max(64,176,166)
// purple to sky min(126,41,84), max(148,203,236)!
//brown to teal min(73,41,10), max(40,203,236)
// purple to yellow min(41,10,73), max(203,236,40)!
//102 min(0,0,0), max(255,144,0)!
