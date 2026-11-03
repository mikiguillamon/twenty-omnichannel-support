#!/usr/bin/env node
// Read-only checks. No npm or Twenty API operations are performed here.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(fileURLToPath(new URL('..',import.meta.url)));
const REPO='mikiguillamon/twenty-omnichannel-support';
const NAME='twenty-omnichannel-support';
const SEMVER=/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

export function releaseProblems(pkg,{publicRelease=false,tag}={}){
  const errors=[];
  if(pkg.name!==NAME)errors.push('Package name must be '+NAME);
  if(!SEMVER.test(pkg.version??''))errors.push('Version must be valid semver');
  if(!pkg.keywords?.includes('twenty-app'))errors.push('Missing twenty-app keyword');
  if(!pkg.engines?.twenty || !pkg.engines.twenty.includes('2.50.0'))errors.push('Declare tested Twenty 2.50 compatibility');
  if(pkg.repository?.url!=='git+https://github.com/'+REPO+'.git')errors.push('Repository URL must match GitHub exactly');
  if(!pkg.homepage?.startsWith('https://github.com/'+REPO))errors.push('Missing project homepage');
  if(pkg.bugs?.url!=='https://github.com/'+REPO+'/issues')errors.push('Missing issue-report URL');
  if(!pkg.description || pkg.description.length<30)errors.push('Missing meaningful package description');
  if(!['MIT','UNLICENSED'].includes(pkg.license))errors.push('Choose and document license: MIT or UNLICENSED');
  if(tag!==undefined && tag!=='v'+pkg.version)errors.push('GitHub Release tag must be v'+pkg.version);
  if(publicRelease){
    if(pkg.private===true)errors.push('PUBLICATION BLOCKED: private=true. Require explicit release approval.');
    if(pkg.publishConfig?.access!=='public')errors.push('PUBLICATION BLOCKED: publishConfig.access must be public.');
    if(pkg.name.endsWith('-jff'))errors.push('PUBLICATION BLOCKED: remove instance-specific package suffix.');
  }
  return errors;
}

const direct=process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const pkg=JSON.parse(readFileSync(resolve(ROOT,'package.json'),'utf8'));
  const pos=process.argv.indexOf('--tag');
  const inline=process.argv.find(a=>a.startsWith('--tag='));
  const tag=inline?inline.slice(6):pos>=0?process.argv[pos+1]:undefined;
  const errors=releaseProblems(pkg,{publicRelease:process.argv.includes('--public'),tag});
  if(errors.length){for(const item of errors)process.stderr.write('FAIL: '+item+'\n');process.exitCode=1;}
  else process.stdout.write('OK: release preflight for '+pkg.name+'@'+pkg.version+'\n');
}
