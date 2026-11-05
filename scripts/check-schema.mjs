import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../src/', import.meta.url);
const files=[];
function walk(dir){for(const name of readdirSync(dir)){
  const path=join(dir,name);
  if(statSync(path).isDirectory())walk(path);
  else if(/\.tsx?$/.test(name))files.push(path);
}}
walk(root.pathname);
const idsSource=readFileSync(new URL('../src/constants/ids.ts', import.meta.url),'utf8');
const ids=[...idsSource.matchAll(/^\s+([A-Z][A-Z0-9_]+): '([a-f0-9-]{36})'/gm)];
const names=new Set(ids.map(m=>m[1]));
const uuids=new Set(ids.map(m=>m[2]));
if(ids.length!==names.size || ids.length!==uuids.size)throw new Error('Duplicated identifier name or UUID');
if(files.length<40)throw new Error('Unexpectedly small source bundle');
const contents=files.map(file=>({file,text:readFileSync(file,'utf8')}));
for(const {file,text} of contents){
  for(const id of text.matchAll(/IDS\.([A-Z][A-Z0-9_]+)/g)){
    if(!names.has(id[1]))throw new Error(`Missing IDS.${id[1]} in ${file}`);
  }
}
// Every custom many-to-one relation must have a valid inverse field declaration.
const relationFiles=contents.filter(({text})=>text.includes('defineField(')&&text.includes('relationTargetFieldMetadataUniversalIdentifier'));
const relationships=new Map();
for(const {file,text} of relationFiles){
  const a=/universalIdentifier:\s*IDS\.([A-Z][A-Z0-9_]+)/.exec(text);
  const b=/relationTargetFieldMetadataUniversalIdentifier:\s*IDS\.([A-Z][A-Z0-9_]+)/.exec(text);
  if(a&&b)relationships.set(a[1],{to:b[1],file});
}
for(const [from,{to,file}] of relationships){
  if(!relationships.has(to))throw new Error(`Relation ${from} in ${file} missing inverse ${to}`);
  if(relationships.get(to).to!==from)throw new Error(`Relation ${from} and ${to} are not reciprocal`);
}
const objectCount=contents.filter(({file})=>file.includes('/objects/')).length;
if(objectCount!==8)throw new Error(`Expected 8 objects, got ${objectCount}`);
const pageCount=contents.filter(({file})=>file.includes('/page-layouts/')).length;
if(pageCount<2)throw new Error('Missing page layouts');
console.log(`OK: ${files.length} source modules; ${uuids.size} stable IDs; ${objectCount} objects; ${relationships.size/2} relations; ${pageCount} layouts`);
