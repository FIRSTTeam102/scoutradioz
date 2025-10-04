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
    await utilities.remove('supporters', {});
    // insert a set of supporters
    await utilities.insert('supporters', { "type": "donor", "name": "FRC Team 4068", "amount": 100 })
    await utilities.insert('supporters', { "type": "donor", "name": "Aditya Hebbar", "amount": 5 })
    await utilities.insert('supporters', { "type": "donor", "name": "5126", "amount": 20 })
    process.exit(0);
})();