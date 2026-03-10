declare global {
	const Cookies: {
		get: (...args: any[]) => any;
		set: (...args: any[]) => any;
	};
}
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}
export {};