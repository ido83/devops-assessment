/**
 * Versioning Strategy Templates
 * Provides common versioning schemes: SemVer, CalVer, etc.
 * Each template returns { name, description, nodes, edges }
 */
import { mkId } from '../utils/graphEngine';
function tpl(fn){const ids={};const mk=(k)=>{ids[k]=mkId();return ids[k];};return fn(mk,ids);}

export const VERSION_TEMPLATES = {
semver:()=>tpl((mk,ids)=>({
  name:'Semantic Versioning (SemVer)',cat:'Standard',
  description:'MAJOR.MINOR.PATCH — increment MAJOR for breaking changes, MINOR for features, PATCH for fixes. Pre-release: -alpha.1, -beta.2, -rc.1',
  nodes:[
    {id:mk('s1'),label:'1.0.0 (Initial)',type:'tag',sub:'First stable release'},
    {id:mk('p1'),label:'1.0.1 (Patch)',type:'commit',sub:'Bug fix, no API change'},
    {id:mk('m1'),label:'1.1.0 (Minor)',type:'branch',sub:'New feature, backwards-compatible'},
    {id:mk('p2'),label:'1.1.1 (Patch)',type:'commit',sub:'Bug fix in 1.1.x'},
    {id:mk('mj1'),label:'2.0.0-alpha.1',type:'branch',sub:'Pre-release: breaking change'},
    {id:mk('mj2'),label:'2.0.0-rc.1',type:'merge',sub:'Release candidate'},
    {id:mk('mj3'),label:'2.0.0 (Major)',type:'tag',sub:'Breaking change released'},
  ],edges:[{from:ids.s1,to:ids.p1},{from:ids.p1,to:ids.m1},{from:ids.m1,to:ids.p2},{from:ids.m1,to:ids.mj1},{from:ids.mj1,to:ids.mj2},{from:ids.mj2,to:ids.mj3}],
})),
calver:()=>tpl((mk,ids)=>({
  name:'Calendar Versioning (CalVer)',cat:'Standard',
  description:'YYYY.MM.DD or YYYY.MM.MICRO — version based on release date. Used by Ubuntu, pip, Unity.',
  nodes:[
    {id:mk('s1'),label:'2025.01',type:'tag',sub:'January release'},
    {id:mk('s2'),label:'2025.02',type:'tag',sub:'February release'},
    {id:mk('p1'),label:'2025.02.1',type:'commit',sub:'Hotfix for Feb release'},
    {id:mk('s3'),label:'2025.03',type:'tag',sub:'March release'},
  ],edges:[{from:ids.s1,to:ids.s2},{from:ids.s2,to:ids.p1},{from:ids.s2,to:ids.s3}],
})),
hash_based:()=>tpl((mk,ids)=>({
  name:'Hash-Based / Commit Versioning',cat:'Modern',
  description:'Use Git commit SHA or short hash as version. Common in CI/CD and container images. No manual bumping.',
  nodes:[
    {id:mk('s1'),label:'abc1234',type:'commit',sub:'Commit hash as version'},
    {id:mk('s2'),label:'def5678',type:'commit',sub:'Next commit'},
    {id:mk('d1'),label:'Image: app:def5678',type:'tag',sub:'Docker tag = commit hash'},
    {id:mk('d2'),label:'Deploy def5678',type:'merge',sub:'Deploy by hash reference'},
  ],edges:[{from:ids.s1,to:ids.s2},{from:ids.s2,to:ids.d1},{from:ids.d1,to:ids.d2}],
})),
build_number:()=>tpl((mk,ids)=>({
  name:'Build Number Versioning',cat:'Standard',
  description:'Auto-incrementing build numbers from CI. Often combined: 1.2.3+build.456. Simple, no ambiguity.',
  nodes:[
    {id:mk('s1'),label:'Build #100',type:'commit',sub:'CI auto-increment'},
    {id:mk('s2'),label:'Build #101',type:'commit',sub:'Next build'},
    {id:mk('t1'),label:'v1.2.3+101',type:'tag',sub:'SemVer + build metadata'},
    {id:mk('d1'),label:'Artifact: app-101',type:'merge',sub:'Build number in artifact name'},
  ],edges:[{from:ids.s1,to:ids.s2},{from:ids.s2,to:ids.t1},{from:ids.t1,to:ids.d1}],
})),
git_tag_flow:()=>tpl((mk,ids)=>({
  name:'Git Tag Release Flow',cat:'Standard',
  description:'Tag commits in Git to mark releases. CI triggers on tags. Combines with SemVer or CalVer.',
  nodes:[
    {id:mk('s1'),label:'Feature Commits',type:'commit',sub:'Development work'},
    {id:mk('m1'),label:'Merge to Main',type:'merge',sub:'PR merged'},
    {id:mk('t1'),label:'git tag v1.3.0',type:'tag',sub:'Annotated tag on main'},
    {id:mk('c1'),label:'CI Triggered',type:'branch',sub:'Tag push triggers pipeline'},
    {id:mk('d1'),label:'Build + Publish',type:'merge',sub:'Release artifact created'},
    {id:mk('r1'),label:'GitHub Release',type:'tag',sub:'Release notes + changelog'},
  ],edges:[{from:ids.s1,to:ids.m1},{from:ids.m1,to:ids.t1},{from:ids.t1,to:ids.c1},{from:ids.c1,to:ids.d1},{from:ids.d1,to:ids.r1}],
})),
monorepo_ver:()=>tpl((mk,ids)=>({
  name:'Monorepo Independent Versioning',cat:'Modern',
  description:'Each package in monorepo has its own version. Tools: Lerna, Changesets, Nx. Selective publishing.',
  nodes:[
    {id:mk('s1'),label:'packages/core@2.1.0',type:'branch',sub:'Core library version'},
    {id:mk('s2'),label:'packages/ui@1.5.0',type:'branch',sub:'UI library version'},
    {id:mk('s3'),label:'packages/api@3.0.0',type:'branch',sub:'API package version'},
    {id:mk('c1'),label:'changeset add',type:'commit',sub:'Declare change intent'},
    {id:mk('m1'),label:'changeset version',type:'merge',sub:'Auto-bump affected packages'},
    {id:mk('d1'),label:'Selective Publish',type:'tag',sub:'Only changed packages'},
  ],edges:[{from:ids.s1,to:ids.c1},{from:ids.s2,to:ids.c1},{from:ids.s3,to:ids.c1},{from:ids.c1,to:ids.m1},{from:ids.m1,to:ids.d1}],
})),
};

export const VERSION_NODE_COLORS={branch:'#6c5ce7',commit:'#ffd166',merge:'#00cec9',tag:'#ff8c42'};
export const VERSION_NODE_ICONS={branch:'🌿',commit:'📝',merge:'🔀',tag:'🏷️'};
export const VERSION_TEMPLATE_LIST=[
  {key:'semver',icon:'📐',cat:'Standard'},{key:'calver',icon:'📅',cat:'Standard'},
  {key:'build_number',icon:'🔢',cat:'Standard'},{key:'git_tag_flow',icon:'🏷️',cat:'Standard'},
  {key:'hash_based',icon:'#️⃣',cat:'Modern'},{key:'monorepo_ver',icon:'📦',cat:'Modern'},
];
