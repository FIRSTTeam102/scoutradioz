import express from 'express';
import { getLogger } from 'log4js';
import wrap from '../../helpers/express-async-handler';
import utilities from '@firstteam102/scoutradioz-utilities';
import Permissions from '../../helpers/permissions';
import e from '@firstteam102/http-errors';
import type { Layout } from '@firstteam102/scoutradioz-types';

const router = express.Router();
const logger = getLogger('orgconfig');

router.all('/*', wrap(async (req, res, next) => {
	logger.removeContext('funcName');
	//Require team-admin-level authentication for every method in this route.
	if (await req.authenticate (Permissions.ACCESS_TEAM_ADMIN)) {
		next();
	}
}));

router.get('/', wrap(async (req, res) => {
	
	res.redirect('/manage');
	
}));

router.get('/pitsurvey', wrap(async (req, res) => {
	if( !await req.authenticate( Permissions.ACCESS_TEAM_ADMIN ) ) return;
		
	let org_key = req._user.org_key;
	
	let yearStr = req.query.year || req.event.key;
	let year: number;
	if (typeof yearStr === 'string') year = parseInt(yearStr);
	else throw new e.UserError('Either "year" or "key" must be set.');
	
	// 2020-02-11, M.O'C: Combined "scoutinglayout" into "layout" with an org_key & the type "pitscouting"
	//var pitlayout = await utilities.find("scoutinglayout", {org_key: req.user.org_key, year: year}, {sort: {"order": 1}})
	let pitlayout: Layout[] = await utilities.find('layout', {org_key: org_key, year: year, form_type: 'pitscouting'}, {sort: {'order': 1}});
	
	res.render('./manage/config/pitsurvey', {
		title: 'Pit Survey Layout',
		pitlayout: pitlayout,
		year: year
	});
	
}));

module.exports = router;