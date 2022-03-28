# public-src
This folder contains sources for static files, i.e. CSS and JS.

## CSS
CSS styling is now created via [LESS](https://lesscss.org). Source files are now located in **public-src/less**. The base file is **base.less**, which imports all others in the folder.

They are compiled into one monolithic CSS file in **public/css/style.css**. The NPM script (in the main Primary folder) `compile-less` compiles it minified, and the NPM script `compile-less-dev` compiles it without minification.

## JS
Static JS files are now created using TypeScript. They are split into two categories: *bundled* and *individual*.

Both types are compiled with the NPM script `compile-ts` (again, in the main Primary folder).

### Bundled
Before, we had multiple script files which needed to be loaded for every page. To avoid unnecessary network requests and improve page load time, we can bundle them into one. The folder **public-src/ts-bundled** contains separate TypeScript files for globally-accessible classes and miscellaneous methods, which get bundled into **public/js/bundle.js**.

### Individual
Lastly, individual JS scripts are located in **public-src/ts**. They are compiled and bundled into **public/js/** but keep their original filename.

## All at once
To compile all of them at once, run the NPM script `compile-static`, again in the main Primary folder.