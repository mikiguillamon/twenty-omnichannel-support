import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { releaseProblems } from '../scripts/release-preflight.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));

test('package and LICENSE declare public MIT distribution', () => {
  assert.notEqual(pkg.private, true);
  assert.equal(pkg.license, 'MIT');
  assert.match(read('LICENSE'), /^MIT License/);
  assert(read('LICENSE').includes('Copyright (c) 2026 Just For Fun 360, S.L.'));
});

test('release preflight passes with matching beta tag', () => {
  assert.deepEqual(releaseProblems(pkg), []);
  assert.deepEqual(releaseProblems(pkg, { publicRelease: true, tag: 'v' + pkg.version }), []);
});

test('a private build or a non-MIT license cannot be released publicly', () => {
  assert(releaseProblems({ ...pkg, private: true }, { publicRelease: true }).some(x => x.includes('private=true')));
  assert(releaseProblems({ ...pkg, license: 'UNLICENSED' }, { publicRelease: true }).some(x => x.includes('MIT')));
});

test('wrong tag or repository is rejected', () => {
  assert(releaseProblems(pkg, { tag: 'v0.0.0' }).some(x => x.includes('tag')));
  assert(releaseProblems({ ...pkg, repository: { url: 'git+https://github.com/elsewhere/repo.git' } }).some(x => x.includes('Repository')));
});
