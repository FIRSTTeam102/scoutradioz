import express from 'express';
import wrap from '../helpers/express-async-handler';
import utilities from 'scoutradioz-utilities';
import * as e from 'scoutradioz-http-errors';

const router = express.Router();

router.get('/', wrap(async (req, res, next) => {
	e.assert(typeof req.query.org === 'string' && typeof req.query.page === 'string', new e.UserError('Required: org and page parameters'));
	const org_key = req.query.org;
	const page = decodeURIComponent(req.query.page);
	const org = await utilities.findOne('orgs', 
		{org_key}, {},
		{allowCache: true, maxCacheAge: 300},
	);
	e.assert(org, new e.NotFoundError(`Org ${org_key} not found`));

	res.cookie('picked_org', org_key);
	res.redirect(page);
}));

export default router;