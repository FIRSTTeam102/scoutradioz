/**
 * @fileoverview Require a &#39;title&#39; parameter in Express res.render calls.
 * @author JL102
 */
"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

var rule = require("../../../lib/rules/res-render-require-title"),

    RuleTester = require("eslint").RuleTester;


//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

var ruleTester = new RuleTester();
ruleTester.run("res-render-require-title", rule, {

    valid: [

        // give me some code that won't trigger a warning
    ],

    invalid: [
        {
            code: "res.render('.path/to/view');",
            errors: [{
                message: "Fill me in.",
                type: "Me too"
            }]
        }
    ]
});
