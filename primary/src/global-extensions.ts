export {};

declare global {
	// JL: Colors is no longer maintained, and the TS declarations are out of date.
	interface String {
		brightRed: string;
		brightGreen: string;
		brightYellow: string;
		brightBlue: string;
		brightMagenta: string;
		brightCyan: string;
		brightWhite: string;
		bgBrightRed: string,
		bgBrightGreen: string,
		bgBrightYellow: string,
		bgBrightBlue: string,
		bgBrightMagenta: string,
		bgBrightCyan: string,
		bgBrightWhite: string,
	}
	
	interface StringDict {
		[key: string]: string;
	}
}