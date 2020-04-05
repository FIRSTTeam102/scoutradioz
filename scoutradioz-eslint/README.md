# eslint-plugin-scoutradioz-eslint

Eslint rules for the Scoutradioz workspace.

## Installation

You'll first need to install [ESLint](http://eslint.org):

```
$ npm i eslint --save-dev
```

Next, install `eslint-plugin-scoutradioz-eslint`:

```
$ npm install eslint-plugin-scoutradioz-eslint --save-dev
```

**Note:** If you installed ESLint globally (using the `-g` flag) then you must also install `eslint-plugin-scoutradioz-eslint` globally.

## Usage

Add `scoutradioz-eslint` to the plugins section of your `.eslintrc` configuration file. You can omit the `eslint-plugin-` prefix:

```json
{
    "plugins": [
        "scoutradioz-eslint"
    ]
}
```


Then configure the rules you want to use under the rules section.

```json
{
    "rules": {
        "scoutradioz-eslint/rule-name": 2
    }
}
```

## Supported Rules

* Fill in provided rules here





