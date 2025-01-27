// TS compilation is computationally expensive, so it's better that we do it in a child thread
const ts = require('typescript');
const path = require('path');
const fs = require('fs');
require('colors');
const { bundledName, indivName, errorName } = require('./names');
const { pathToTsBundled, pathToTs, pathToPublicJs } = require('./paths');

const formatHost = {
	getCanonicalFileName: path => path,
	getCurrentDirectory: ts.sys.getCurrentDirectory,
	getNewLine: () => ts.sys.newLine
};

// https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
function watchPath(path, name, afterProgramCreate) {
	
	const configPath = ts.findConfigFile(
		path,
		ts.sys.fileExists,
		'tsconfig.json'
	);
	if (!configPath) {
		throw new Error('Could not find a valid \'tsconfig.json\'.');
	}
	const createProgram = ts.createEmitAndSemanticDiagnosticsBuilderProgram;
	
	// Note that there is another overload for `createWatchCompilerHost` that takes
	// a set of root files.
	const host = ts.createWatchCompilerHost(
		configPath,
		{},
		ts.sys,
		createProgram,
		reportDiagnostic,
		reportWatchStatusChanged
	);
  
	// You can technically override any given hook on the host, though you probably
	// don't need to.
	// Note that we're assuming `origCreateProgram` and `origPostProgramCreate`
	// doesn't use `this` at all.
	const origCreateProgram = host.createProgram;
	host.createProgram = (rootNames, options, host, oldProgram) => {
		return origCreateProgram(rootNames, options, host, oldProgram);
	};
	const origPostProgramCreate = host.afterProgramCreate;
  
	host.afterProgramCreate = program => {
		origPostProgramCreate(program);
		if (afterProgramCreate) afterProgramCreate();
	};
  
	// `createWatchProgram` creates an initial program, watches files, and updates
	// the program over time.
	let watchProgram = ts.createWatchProgram(host);
	
	return watchProgram;
  
	function reportDiagnostic(diagnostic) {
		console.error(`${name.brightYellow}: ${errorName}: ${ts.flattenDiagnosticMessageText( diagnostic.messageText, formatHost.getNewLine())}\n\t${diagnostic.file.fileName}`);
	}
	
	/**
	 * Prints a diagnostic every time the watch status changes.
	 * This is mainly for messages like "Starting compilation" or "Compilation completed".
	 * @param {ts.Diagnostic} diagnostic
	 */
	function reportWatchStatusChanged(diagnostic) {
		console.log(`${name.brightYellow}: ${diagnostic.messageText}`);
	}
}

watchPath(pathToTsBundled, bundledName, () => {
	const fromPath = path.join(pathToPublicJs, 'bundle.d.ts');
	const toPath = path.join(pathToTs, 'bundle.d.ts');
	if (fs.existsSync(fromPath)) {
		try {
			fs.renameSync(fromPath, toPath);
			console.log(`${bundledName}: Moved bundle TS declaration file.`);
		}
		catch (err) {
			console.log(`${bundledName}: Failed to move bundle TS declaration file: `, err);
		}
	}
	else {
		console.log(`${bundledName}: Bundle TS declaration not found. Compilation may have failed.`);
	}
});

watchPath(pathToTs, indivName);