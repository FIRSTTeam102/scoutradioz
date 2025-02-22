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
    await utilities.insert('heatmapcolors', { name: 'Default Red/Green', key: 'default', min: { r: 63, g: 0, b: 0 }, max: { r: 0, g: 214, b: 0 } })
    await utilities.insert('heatmapcolors', { name: 'Grayscale', key: 'grayscale', min: { r: 0, g: 0, b: 0 }, max: { r: 200, g: 200, b: 200 } })
    await utilities.insert('heatmapcolors', { name: 'Sunburst', key: 'sunburst', min: { r: 110, g: 8, b: 36 }, max: { r: 244, g: 179, b: 1 } })
    await utilities.insert('heatmapcolors', { name: 'City Night', key: 'citynight', min: { r: 41, g: 10, b: 73 }, max: { r: 203, g: 236, b: 40 } })
    await utilities.insert('heatmapcolors', { name: '102!!!', key: '102', min: { r: 0, g: 0, b: 0 }, max: { r: 255, g: 144, b: 0 } })

    process.exit(0);
})();


// grayscale min(0,0,0), max(200,200,200)!
// default min(63,0,0),max(0,214,0)!
// blue to yellow min(2,81,150), max(253,179,56)
// purple to orange min(81,40,136), max(235,97,35)
// green to purple min(41,94,17), max(176,18,158)
// brown to blue min(106,74,60), max(15,101,161)
// brick to yellow min(110,8,36), max(244,179,1)!
// tan to turquoise min(255,190,106), max(64,176,166)
// purple to sky min(126,41,84), max(148,203,236)
//brown to teal min(73,41,10), max(40,203,236)
// purple to yellow min(41,10,73), max(203,236,40)!
//102 min(0,0,0), max(255,144,0)
