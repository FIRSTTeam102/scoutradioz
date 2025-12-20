declare global {
	const Cookies: {
		get: (...args: any[]) => any;
		set: (...args: any[]) => any;
	};
}
export {};