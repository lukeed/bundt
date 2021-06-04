<div align="center">
  <img src="logo.png" alt="bundt" height="110" />
</div>

<div align="center">
  <a href="https://github.com/lukeed/bundt/actions">
    <img src="https://github.com/lukeed/bundt/workflows/CI/badge.svg" alt="CI" />
  </a>
  <a href="https://npmjs.org/package/bundt">
    <img src="https://badgen.net/npm/v/bundt" alt="version" />
  </a>
  <a href="https://npmjs.org/package/bundt">
    <img src="https://badgen.net/npm/dm/bundt" alt="downloads" />
  </a>
</div>

<div align="center">A simple bundler for your delicious modules~!</div>

## Features

* Release CommonJS, ES Module, and UMD targets
* Easily configured through your `package.json`
* Optionally control Terser settings

***Gotchas***

Your code is prepared for release targets ***as written***!

* Does not transpile your code<br>_AKA – no Babel or Buble_
* Does not inline dependencies<br>_AKA – no Rollup or Webpack_

If you need either of these, using [`microbundle`](https://github.com/developit/microbundle) comes ***highly recommended***!

> Seriously, I write wonky ES5 code in a single file...<br>`bundt` only puts a name to the builder script I copy & paste between libraries.<br>You are 99.9999% more likely to do better with `microbundle` and/or to not outgrow it.

## Install

```
$ npm install --save-dev bundt
```


## Usage

```sh
# display help text
$ bundt --help

# build with "lib/index.js" as your entry file
$ bundt lib/index.js

# build with "src/index.js" (default)
$ bundt
```


## Configuration

Most configuration lives within your `package.json` file. The following keys are evaluated:

* **"main"** &mdash; the destination for your CommonJS file<br>_Defaults to `dist/{pkg.name}.js` – always built!_

* **"module"** &mdash; the destination for your ES Module file<br>_A ESM file will not be built if unspecified!_

* **"unpkg"** or **"umd:main"** &mdash; the destination for your UMD file<br>_A UMD file will not be built if unspecified!_

* **"umd:name"** or **"name"** &mdash; the globally exposed name for your UMD factory<br>_You should use an alternate `umd:name` if your `name` is not alphanumeric!_

* **"modes"** &mdash; a map of "mode" names and their entry files<br>_Your `"default"` mode will use the destinations defined above.<br>All other modes replace `dist` with its name as the new directory._

* **"terser"** &mdash; custom [Terser options](https://github.com/terser-js/terser#minify-options) for minification<br>_Alternatively, you may use a `.terserrc` file~!_


## License

MIT © [Luke Edwards](https://lukeed.com)

<hr>

<sup><em>Logo by [iconicbestiary](https://www.freepik.com/free-vector/various-desserts-bakery_1310918.htm#page=2&position=38)</em></sup>
