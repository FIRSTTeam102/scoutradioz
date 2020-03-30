A very basic module that defines errors with HTTP status codes, such as 400 Bad Request.
https://scoutradioz.com

Usage: 
```js
const e = require('@firstteam102/http-errors');

router.get('/throwanerror', function(req, res) {
	
	throw new e.UserError('Invalid input');
});
```