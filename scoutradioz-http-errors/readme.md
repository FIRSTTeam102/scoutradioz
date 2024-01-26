## http-errors

A very basic module that defines errors with HTTP status codes, such as 400 Bad Request.
https://scoutradioz.com

Usage: 
```js
const e = require('scoutradioz-http-errors');

router.get('/throwanerror', function(req, res) {
	
	throw new e.UserError('Invalid input');
});
```

To update:
1. `tsc`
1. Edit `package.json` with a new version number
1. `npm publish`