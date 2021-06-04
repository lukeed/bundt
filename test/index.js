// TODO:
//   Convert "expects" file to `.js` type
//   so that each can run custom assertions!

const fs = require('fs');
const { join } = require('path');
const assert = require('uvu/assert');
const { spawnSync } = require('child_process');
const { premove } = require('premove');
const { test } = require('uvu');

const bin = require.resolve('..');
const fixtures = join(__dirname, 'fixtures');

const tests = {
	cjs: /(module\.)?exports(\.?)/,
	esm: /export ((default )?(function|const|class|let|var)|{)/,
	umd: new RegExp(`"object"==typeof exports&&"undefined"!=typeof module`)
};

function exec(cwd, src, flags=[]) {
	let args = [bin].concat(src || [], flags);
	return spawnSync('node', args, { cwd });
}

function normalize(contents) {
	return contents.trim().replace(/\r?\n/g, '\n');
}

fs.readdirSync(fixtures).forEach(dirname => {
	let dir = join(fixtures, dirname);
	let expects = require( join(dir, 'expects.json') );

	test(dirname, async () => {
		let pid = exec(dir, expects.entry, expects.argv);
		assert.ok(pid.stdout.length, 'prints table to stdout');
		assert.is(pid.status, 0, 'runs without error');

		for (let k in expects) {
			if (/entry|name|argv/.test(k)) continue;

			if (k === 'exists') {
				expects[k].forEach(file => {
					let full = join(dir, file);
					assert.ok(fs.existsSync(full), `(${file}) ~> file exists`)
				});
				continue;
			}

			let file = join(dir, expects[k]);
			assert.ok(fs.existsSync(file), `(${k}) ~> file exists`);

			let data = fs.readFileSync(file, 'utf8');
			assert.ok(tests[k].test(data), `(${k}) ~> contents look right`);

			let output = join(dir, `output.${k}.js`);
			if (fs.existsSync(output)) {
				output = fs.readFileSync(output, 'utf8');
				assert.fixture(
					normalize(data),
					normalize(output),
				);
			}

			if (k === 'cjs') {
				assert.not.throws(() => new Function(data), SyntaxError);
			} else if (k === 'umd' && 'name' in expects) {
				assert.ok(data.includes(expects.name), `(${k}) ~> has custom UMD name`);
			}
		}

		await premove('index.d.ts', { cwd: dir });
		await premove('foobar', { cwd: dir });
		await premove('dist', { cwd: dir });
	});
});

test.run();
