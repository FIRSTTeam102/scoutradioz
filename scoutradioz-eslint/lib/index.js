/**
 * @fileoverview Eslint rules for the Scoutradioz workspace.
 * @author JL102
 */
"use strict";

//------------------------------------------------------------------------------
// Plugin Definition
//------------------------------------------------------------------------------

// import all rules in lib/rules
module.exports = {
	meta: {
		name: 'eslint-plugin-scoutradioz-eslint',
	},
	rules: { 
		'res-render-require-description': require('./rules/res-render-require-description'),
		'res-render-require-title': require('./rules/res-render-require-title'),
	}
}