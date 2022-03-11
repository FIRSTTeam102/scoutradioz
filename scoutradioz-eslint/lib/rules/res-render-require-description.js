/**
 * @fileoverview Require a 'title' parameter in Express res.render calls.
 * @author JL102
 */
"use strict";

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = {
	meta: {
		type: 'problem',
		docs: {
			description: "Require a 'description' parameter in Express res.render calls.",
			category: "Fill me in",
			recommended: false
		},
		fixable: null,  // or "code" or "whitespace"
		schema: [
			// fill in your schema
		]
	},

	create: function(context) {

		// variables should be defined here

		//----------------------------------------------------------------------
		// Helpers
		//----------------------------------------------------------------------

		// any helper functions should go here or else delete this section
		
		const sourceCode = context.getSourceCode();
		
		function findTitleInResRender (node) {
			
			//var startTime = Date.now();
			
			var tokens = sourceCode.getTokens(node);
			
			//return report(node);
			var resRenderLocations = [];
			
			for (var i = 0; i < tokens.length; i++) {
				if (tokens[i].value == 'res') {
					let dot = tokens[i + 1];
					let render = tokens[i + 2];
					if (dot && dot.value == '.') {
						if (render && render.value == 'render') {
							//console.log(tokens[i]);
							resRenderLocations.push(i);
						}
					}
				}
			}
			//console.log(resRenderLocations);
			
			for (var index of resRenderLocations) {
				let locStart = tokens[index].loc.start;
				let locEnd;
				let loc;
				
				//index = res, i+1 = ., i+2 = render, i+3 = (
				let leftParen = index + 3;
				
				//Only proceed if the token right after .render is left paren
				// (to confirm that the user is calling res.render())
				if (tokens[leftParen].type == 'Punctuator' && tokens[leftParen].value == '(') {
					
					let rightParen = undefined;
					let numInternalParens = 0;
					
					//Find the end punctuator for the res.render call.
					//	It's not trivial b/c We have to keep track of 
					//	other sets of parentheses inside the function call
					for (var i = index; i < tokens.length; i++) {
						let thisToken = tokens[i];
						if (thisToken.type == 'Punctuator') {
							if (thisToken.value == '(') {
								//if it's not the left paren, increase numInternalParens
								//	that we are tracking.
								if (i != leftParen) {
									numInternalParens++;
								}
							}
							else if(thisToken.value == ')') {
								//If we are tracking internal parens, then decrease
								//	numInternalParens, because we just encountered an end paren
								if (numInternalParens > 0) {
									numInternalParens--;
								}
								//if there are no more internal parens, then we found rightParen
								//	and we can exit the loop
								else {
									rightParen = i;
									break;
								}
							}
						}
					}
					
					//if leftParen and rightParen are defined == if this is a valid res.render call
					if (leftParen && rightParen) {
						
						var includesDescription = false;
						
						for (var i = leftParen; i < rightParen; i++) {
							var thisToken = tokens[i];
							var nextToken = tokens[i + 1];
							if (thisToken.value == 'description') {
								//we have to make sure the following token is :
								//	because we don't want res.render('', {foo: title})
								if (nextToken.type == 'Punctuator' && nextToken.value == ':'){
									includesDescription = true;
								}
							}
						}
						
						if (includesDescription == false) {
							locEnd = tokens[rightParen].loc.end;
							
							loc = {
								start: locStart,
								end: locEnd
							}
							
							report(node, loc);
						}
					}
				}
			}
			//console.log(`${Date.now() - startTime} ms`);
		}
		
		/**
		 * Reports a given indent violation
		 * @param {Token} node Token violating the rule
		 * @returns {void}
		 */
		function report(node, loc) {
			
			context.report({
				node: node,
				message: "Res.render must include a description",
				data: {
				},
				loc: loc,
			});
		}
		
		
		return {
			"FunctionExpression:exit": findTitleInResRender,
			"ArrowFunctionExpression:exit": findTitleInResRender,
		};
	}
};
