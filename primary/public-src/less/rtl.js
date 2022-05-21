// Plugin to automatically convert CSS to use logical properties for compatibility with RTL languages
// @see: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Logical_Properties/Floating_and_positioning

function getRTLPlugin(less) {
	function RTLPlugin(options) {
		this._options = options;
		this._visitor = new less.visitors.Visitor(this);
	};

	function modifyKeyword(doIt, node) {
		if (!doIt) return node;

		switch(node.value) {
			case 'left':
				return new less.tree.Keyword(node.parent.name === 'text-align' ? 'start' : 'inline-start');
			case 'right':
				return new less.tree.Keyword(node.parent.name === 'text-align' ? 'end' : 'inline-end');
			default:
				return node;
		}
	}

	RTLPlugin.prototype = {
		isReplacing: true,
		run: function(root) {
			return this._visitor.visit(root);
		},
		visitDeclaration: function(node, visitArgs) {
			if (node.variable) return node;
			// CD 2022-05-20: @see https://github.com/less/less.js/issues/3243
			if (!node.currentFileInfo.filename || !node.currentFileInfo.filename.endsWith('w3.less')) return node;

			var nodeName = node.name
				nodeNameRegex = /(border|inset|margin|padding)(?:-(left|right)($|-.+)|$)/;

			if (nodeName.match(nodeNameRegex)) {
				nodeName = nodeName.replace(nodeNameRegex, function(allOfMatch, leftPart, replacePart, rightPart = '') {
					if (replacePart === 'left') {
						replacePart = 'inline-start';
					} else if (replacePart === 'right') {
						replacePart = 'inline-end';
					} /*else if (replacePart === undefined) {
						replacePart = 'inline';
					}*/ else {
						return nodeName;
					}
					return leftPart + '-' + replacePart + rightPart;
				});
			}

			if ([/*'clear', 'float',*/ 'text-align'].includes(nodeName)) { // CD 2022-05-20: clear and float inline don't seem to work, patch in w3-additions.less
				this._modifyKeywords = true;
			}

			if (nodeName !== node.name) {
				return new less.tree.Declaration(
					nodeName,
					node.value,
					node.important,
					node.merge,
					node.index,
					node.currentFileInfo,
					node.inline,
					node.variable);
			}

			return node;
		},
		visitDeclarationOut: function() {
			this._modifyKeywords = false;
		},
		visitAnonymous: function(anonNode, visitArgs) {
			return modifyKeyword(this._modifyKeywords, anonNode);
		},
		visitKeyword: function(keywordNode, visitArgs) {
			return modifyKeyword(this._modifyKeywords, keywordNode);
		}
	};
	return RTLPlugin;
}

function LessPluginRTL(options) {
	this.options = options;
}

LessPluginRTL.prototype = {
	install: function(less, pluginManager, functions) {
		var RTLPlugin = getRTLPlugin(less);
		pluginManager.addVisitor(new RTLPlugin(this.options));
	},
	printUsage: function() {},
	setOptions: function(options) {},
	minVersion: [2, 4, 0]
};

module.exports = LessPluginRTL;