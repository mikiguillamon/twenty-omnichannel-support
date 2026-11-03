import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {releaseProblems} from '../scripts/release-preflight.mjs';
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));

test('normal release preflight passes without publishing',()=>{
  assert.deepEqual(releaseProblems(pkg),[]);
});
test('public release remains blocked until explicit private flag change',()=>{
  assert.match(releaseProblems(pkg,{publicRelease:true,tag:'v'+pkg.version}).join(' '),/private=true/);
});
test('public metadata is complete once public release is approved',()=>{
  const publishable={...pkg,private:false};
  assert.deepEqual(releaseProblems(publishable,{publicRelease:true,tag:'v'+pkg.version}),[]);
});
test('wrong tag and repository are rejected',()=>{
  assert(releaseProblems(pkg,{tag:'v0.0.0'}).some(s=>s.includes('tag')));
  assert(releaseProblems({...pkg,repository:{url:'git+https://github.com/another/repo.git'}}).some(s=>s.includes('Repository')));
});
