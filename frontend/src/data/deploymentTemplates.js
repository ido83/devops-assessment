import { mkId } from '../utils/graphEngine';
function tpl(fn){const ids={};const mk=(k)=>{ids[k]=mkId();return ids[k];};return fn(mk,ids);}

export const DEPLOY_TEMPLATES = {
blue_green:()=>tpl((mk,ids)=>({
  name:'Blue-Green Deployment',cat:'Standard',
  description:'Two identical environments (blue/green). Traffic switches entirely from old to new. Instant rollback by switching back.',
  nodes:[
    {id:mk('s1'),label:'New Build Ready',type:'source',sub:'Artifact validated'},{id:mk('d1'),label:'Deploy to Green',type:'deploy',sub:'Idle environment'},
    {id:mk('t1'),label:'Smoke Test Green',type:'test',sub:'Health + e2e on green'},{id:mk('ap1'),label:'Approval Gate',type:'approve',sub:'Release manager'},
    {id:mk('d2'),label:'Switch Router',type:'deploy',sub:'LB/DNS → green (100%)'},{id:mk('m1'),label:'Monitor',type:'monitor',sub:'Error rates + latency'},
    {id:mk('b1'),label:'Rollback?',type:'gate',sub:'If errors: switch back to blue'},{id:mk('r1'),label:'Decommission Blue',type:'release',sub:'Blue becomes next green'},
  ],edges:[{from:ids.s1,to:ids.d1},{from:ids.d1,to:ids.t1},{from:ids.t1,to:ids.ap1},{from:ids.ap1,to:ids.d2},{from:ids.d2,to:ids.m1},{from:ids.m1,to:ids.b1},{from:ids.b1,to:ids.r1}],
})),
rolling:()=>tpl((mk,ids)=>({
  name:'Rolling (Incremental) Deployment',cat:'Standard',
  description:'Gradually replace instances one-by-one or in batches. No downtime. Slower rollout allows early detection of issues.',
  nodes:[
    {id:mk('s1'),label:'New Version',type:'source',sub:'Image/artifact ready'},{id:mk('d1'),label:'Update Batch 1',type:'deploy',sub:'Replace 25% of instances'},
    {id:mk('m1'),label:'Health Check',type:'monitor',sub:'Verify batch 1 healthy'},{id:mk('d2'),label:'Update Batch 2',type:'deploy',sub:'Replace next 25%'},
    {id:mk('m2'),label:'Health Check',type:'monitor',sub:'Verify batch 2'},{id:mk('d3'),label:'Update Batch 3-4',type:'deploy',sub:'Remaining instances'},
    {id:mk('r1'),label:'Complete',type:'release',sub:'100% on new version'},
  ],edges:[{from:ids.s1,to:ids.d1},{from:ids.d1,to:ids.m1},{from:ids.m1,to:ids.d2},{from:ids.d2,to:ids.m2},{from:ids.m2,to:ids.d3},{from:ids.d3,to:ids.r1}],
})),
canary:()=>tpl((mk,ids)=>({
  name:'Canary Release',cat:'Standard',
  description:'Route a small percentage of traffic (1-5%) to new version. Gradually increase if metrics are healthy. Quick rollback.',
  nodes:[
    {id:mk('s1'),label:'Canary Build',type:'source',sub:'New version image'},{id:mk('d1'),label:'Deploy Canary Pod',type:'deploy',sub:'1 pod with new version'},
    {id:mk('d2'),label:'Route 5% Traffic',type:'deploy',sub:'Weighted routing / Istio'},{id:mk('m1'),label:'Monitor Metrics',type:'monitor',sub:'Error rate, p99 latency'},
    {id:mk('ap1'),label:'Promote?',type:'approve',sub:'Auto or manual gate'},{id:mk('d3'),label:'Route 25%→50%→100%',type:'deploy',sub:'Gradual traffic shift'},
    {id:mk('r1'),label:'Full Rollout',type:'release',sub:'Canary promoted to stable'},
  ],edges:[{from:ids.s1,to:ids.d1},{from:ids.d1,to:ids.d2},{from:ids.d2,to:ids.m1},{from:ids.m1,to:ids.ap1},{from:ids.ap1,to:ids.d3},{from:ids.d3,to:ids.r1}],
})),
recreate:()=>tpl((mk,ids)=>({
  name:'Recreate Deployment',cat:'Standard',
  description:'Stop all old instances, then start new ones. Simple but causes downtime. Used when versions cannot coexist.',
  nodes:[
    {id:mk('s1'),label:'New Version',type:'source',sub:'Artifact ready'},{id:mk('g1'),label:'Maintenance Window',type:'gate',sub:'Scheduled downtime'},
    {id:mk('d1'),label:'Stop All Old',type:'deploy',sub:'Terminate v1 instances'},{id:mk('d2'),label:'Deploy All New',type:'deploy',sub:'Start v2 instances'},
    {id:mk('t1'),label:'Verify',type:'test',sub:'Smoke tests'},{id:mk('r1'),label:'Live',type:'release',sub:'Service restored'},
  ],edges:[{from:ids.s1,to:ids.g1},{from:ids.g1,to:ids.d1},{from:ids.d1,to:ids.d2},{from:ids.d2,to:ids.t1},{from:ids.t1,to:ids.r1}],
})),
big_bang:()=>tpl((mk,ids)=>({
  name:'Big Bang Deployment',cat:'Standard',
  description:'Replace entire system at once during a cutover window. High risk, used for major migrations or legacy replacements.',
  nodes:[
    {id:mk('g1'),label:'Change Freeze',type:'gate',sub:'Code freeze period'},{id:mk('s1'),label:'Full Package',type:'source',sub:'Complete system build'},
    {id:mk('t1'),label:'Staging Validation',type:'test',sub:'Full regression suite'},{id:mk('ap1'),label:'Go/No-Go',type:'approve',sub:'Stakeholder sign-off'},
    {id:mk('d1'),label:'Cutover Deploy',type:'deploy',sub:'Full system replacement'},{id:mk('m1'),label:'War Room Monitor',type:'monitor',sub:'24h monitoring'},
    {id:mk('r1'),label:'Stabilized',type:'release',sub:'Cutover complete'},
  ],edges:[{from:ids.g1,to:ids.s1},{from:ids.s1,to:ids.t1},{from:ids.t1,to:ids.ap1},{from:ids.ap1,to:ids.d1},{from:ids.d1,to:ids.m1},{from:ids.m1,to:ids.r1}],
})),
standard_cd:()=>tpl((mk,ids)=>({
  name:'Standard Continuous Delivery',cat:'Standard',
  description:'Every commit is a release candidate. Automated pipeline gates. Manual approval before production deploy.',
  nodes:[
    {id:mk('s1'),label:'Commit',type:'source',sub:'Push to main/trunk'},{id:mk('b1'),label:'Build + Test',type:'build',sub:'CI pipeline'},
    {id:mk('sc1'),label:'Security Scan',type:'scan',sub:'SAST + SCA + image scan'},{id:mk('a1'),label:'Publish Artifact',type:'artifact',sub:'Registry / repository'},
    {id:mk('d1'),label:'Deploy Staging',type:'deploy',sub:'Auto-deploy to staging'},{id:mk('t1'),label:'Acceptance Tests',type:'test',sub:'E2E + performance'},
    {id:mk('ap1'),label:'Manual Approval',type:'approve',sub:'Product/Release manager'},{id:mk('d2'),label:'Deploy Prod',type:'deploy',sub:'Production rollout'},
    {id:mk('m1'),label:'Monitor',type:'monitor',sub:'Observability stack'},
  ],edges:[{from:ids.s1,to:ids.b1},{from:ids.b1,to:ids.sc1},{from:ids.sc1,to:ids.a1},{from:ids.a1,to:ids.d1},{from:ids.d1,to:ids.t1},{from:ids.t1,to:ids.ap1},{from:ids.ap1,to:ids.d2},{from:ids.d2,to:ids.m1}],
})),
shadow:()=>tpl((mk,ids)=>({
  name:'Shadow (Dark) Deployment',cat:'Advanced',
  description:'Deploy new version alongside production. Mirror real traffic to shadow without affecting users. Compare responses.',
  nodes:[
    {id:mk('s1'),label:'Shadow Build',type:'source',sub:'New version'},{id:mk('d1'),label:'Deploy Shadow',type:'deploy',sub:'Parallel to production'},
    {id:mk('d2'),label:'Mirror Traffic',type:'deploy',sub:'Duplicate requests to shadow'},{id:mk('m1'),label:'Compare Results',type:'monitor',sub:'Diff responses (Diffy)'},
    {id:mk('t1'),label:'Validate Parity',type:'test',sub:'Functional + perf match'},{id:mk('ap1'),label:'Promote',type:'approve',sub:'Replace prod with shadow'},
  ],edges:[{from:ids.s1,to:ids.d1},{from:ids.d1,to:ids.d2},{from:ids.d2,to:ids.m1},{from:ids.m1,to:ids.t1},{from:ids.t1,to:ids.ap1}],
})),
ab_testing:()=>tpl((mk,ids)=>({
  name:'A/B Testing Deployment',cat:'Advanced',
  description:'Route segments of users to different versions based on criteria. Measure business metrics to determine winner.',
  nodes:[
    {id:mk('s1'),label:'Variant A (Control)',type:'source',sub:'Current version'},{id:mk('s2'),label:'Variant B (Test)',type:'source',sub:'New version'},
    {id:mk('d1'),label:'Traffic Split',type:'deploy',sub:'Feature flag / routing rules'},{id:mk('m1'),label:'Collect Metrics',type:'monitor',sub:'Conversion, engagement, errors'},
    {id:mk('t1'),label:'Statistical Analysis',type:'test',sub:'Significance testing'},{id:mk('r1'),label:'Winner → 100%',type:'release',sub:'Promote winning variant'},
  ],edges:[{from:ids.s1,to:ids.d1},{from:ids.s2,to:ids.d1},{from:ids.d1,to:ids.m1},{from:ids.m1,to:ids.t1},{from:ids.t1,to:ids.r1}],
})),
iac_immutable:()=>tpl((mk,ids)=>({
  name:'IaC Immutable Deployment',cat:'Advanced',
  description:'Never modify running infra. Terraform/Pulumi creates new resources, validates, then destroys old. True infrastructure immutability.',
  nodes:[
    {id:mk('s1'),label:'IaC Change',type:'source',sub:'Terraform / Pulumi PR'},{id:mk('b1'),label:'Plan',type:'build',sub:'terraform plan / preview'},
    {id:mk('sc1'),label:'Policy Check',type:'scan',sub:'OPA / Sentinel / Checkov'},{id:mk('ap1'),label:'Approve Plan',type:'approve',sub:'Review + approve changes'},
    {id:mk('d1'),label:'Apply',type:'deploy',sub:'terraform apply (new resources)'},{id:mk('t1'),label:'Verify',type:'test',sub:'Health + connectivity checks'},
    {id:mk('d2'),label:'Destroy Old',type:'deploy',sub:'Remove previous resources'},
  ],edges:[{from:ids.s1,to:ids.b1},{from:ids.b1,to:ids.sc1},{from:ids.sc1,to:ids.ap1},{from:ids.ap1,to:ids.d1},{from:ids.d1,to:ids.t1},{from:ids.t1,to:ids.d2}],
})),
gitops_reconcile:()=>tpl((mk,ids)=>({
  name:'GitOps-Based Reconciliation',cat:'Advanced',
  description:'Git is the single source of truth. ArgoCD/Flux continuously reconciles cluster state to match Git declarations.',
  nodes:[
    {id:mk('s1'),label:'Git Commit',type:'source',sub:'Update manifests in Git'},{id:mk('d1'),label:'ArgoCD/Flux Detect',type:'deploy',sub:'Drift detection loop'},
    {id:mk('sc1'),label:'Admission Policy',type:'scan',sub:'OPA / Kyverno validate'},{id:mk('d2'),label:'Auto-Sync',type:'deploy',sub:'Apply desired state'},
    {id:mk('m1'),label:'Health Check',type:'monitor',sub:'K8s resource health'},{id:mk('d3'),label:'Self-Heal',type:'deploy',sub:'Auto-repair drift'},
  ],edges:[{from:ids.s1,to:ids.d1},{from:ids.d1,to:ids.sc1},{from:ids.sc1,to:ids.d2},{from:ids.d2,to:ids.m1},{from:ids.m1,to:ids.d3}],
})),
cloud_bursting:()=>tpl((mk,ids)=>({
  name:'Cloud Bursting Deployment',cat:'Hybrid',
  description:'On-prem handles baseline load. Overflow traffic bursts to cloud. Auto-scale cross-environment.',
  nodes:[
    {id:mk('s1'),label:'Baseline (On-Prem)',type:'source',sub:'Local K8s / VMs'},{id:mk('m1'),label:'Load Monitor',type:'monitor',sub:'Threshold detection'},
    {id:mk('d1'),label:'Burst to Cloud',type:'deploy',sub:'Spin up cloud instances'},{id:mk('d2'),label:'Route Overflow',type:'deploy',sub:'GSLB / service mesh'},
    {id:mk('m2'),label:'Cost Monitor',type:'monitor',sub:'Track cloud spend'},{id:mk('d3'),label:'Scale Down',type:'deploy',sub:'Terminate cloud burst'},
  ],edges:[{from:ids.s1,to:ids.m1},{from:ids.m1,to:ids.d1},{from:ids.d1,to:ids.d2},{from:ids.d2,to:ids.m2},{from:ids.m2,to:ids.d3}],
})),
multi_cluster:()=>tpl((mk,ids)=>({
  name:'Federated Multi-Cluster Deployment',cat:'Hybrid',
  description:'Deploy across multiple K8s clusters in different regions/clouds. Kubefed or Liqo for federation. Consistent state.',
  nodes:[
    {id:mk('s1'),label:'Federated Manifest',type:'source',sub:'Multi-cluster config'},{id:mk('d1'),label:'Deploy Cluster A',type:'deploy',sub:'Region US-East'},
    {id:mk('d2'),label:'Deploy Cluster B',type:'deploy',sub:'Region EU-West'},{id:mk('d3'),label:'Deploy Cluster C',type:'deploy',sub:'Region AP-South'},
    {id:mk('m1'),label:'Federated Health',type:'monitor',sub:'Cross-cluster observability'},{id:mk('r1'),label:'DNS/GSLB Update',type:'release',sub:'Global traffic routing'},
  ],edges:[{from:ids.s1,to:ids.d1},{from:ids.s1,to:ids.d2},{from:ids.s1,to:ids.d3},{from:ids.d1,to:ids.m1},{from:ids.d2,to:ids.m1},{from:ids.d3,to:ids.m1},{from:ids.m1,to:ids.r1}],
})),
edge_deploy:()=>tpl((mk,ids)=>({
  name:'Distributed Edge Deployment',cat:'Hybrid',
  description:'Push workloads to edge locations (CDN PoPs, IoT gateways, retail stores). Centralized management, distributed execution.',
  nodes:[
    {id:mk('s1'),label:'Central Registry',type:'source',sub:'Container/WASM images'},{id:mk('d1'),label:'Edge Sync',type:'deploy',sub:'Pull to edge nodes (KubeEdge)'},
    {id:mk('d2'),label:'Edge Site A',type:'deploy',sub:'Retail / factory floor'},{id:mk('d3'),label:'Edge Site B',type:'deploy',sub:'Branch office / CDN PoP'},
    {id:mk('m1'),label:'Central Dashboard',type:'monitor',sub:'Aggregate edge telemetry'},{id:mk('r1'),label:'OTA Update',type:'release',sub:'Over-the-air rollout'},
  ],edges:[{from:ids.s1,to:ids.d1},{from:ids.d1,to:ids.d2},{from:ids.d1,to:ids.d3},{from:ids.d2,to:ids.m1},{from:ids.d3,to:ids.m1},{from:ids.m1,to:ids.r1}],
})),
policy_placement:()=>tpl((mk,ids)=>({
  name:'Policy-Based Workload Placement',cat:'Hybrid',
  description:'Workloads auto-placed based on policies: data residency, cost, latency, compliance. Scheduler decides target environment.',
  nodes:[
    {id:mk('s1'),label:'Workload Spec',type:'source',sub:'App + policy annotations'},{id:mk('sc1'),label:'Policy Engine',type:'scan',sub:'OPA / custom scheduler'},
    {id:mk('d1'),label:'Place: On-Prem',type:'deploy',sub:'Data residency requirement'},{id:mk('d2'),label:'Place: Cloud',type:'deploy',sub:'Cost-optimized burst'},
    {id:mk('d3'),label:'Place: Edge',type:'deploy',sub:'Latency-sensitive'},{id:mk('m1'),label:'Policy Audit',type:'monitor',sub:'Compliance verification'},
  ],edges:[{from:ids.s1,to:ids.sc1},{from:ids.sc1,to:ids.d1},{from:ids.sc1,to:ids.d2},{from:ids.sc1,to:ids.d3},{from:ids.d1,to:ids.m1},{from:ids.d2,to:ids.m1},{from:ids.d3,to:ids.m1}],
})),
sneakernet:()=>tpl((mk,ids)=>({
  name:'Sneakernet / Physical Media Import',cat:'Air Gap',
  description:'Air-gapped: transfer artifacts on physical media (USB/DVD). Manual chain of custody. Checksum verification.',
  nodes:[
    {id:mk('s1'),label:'Build in Clean Room',type:'source',sub:'Approved build environment'},{id:mk('sc1'),label:'Sign + Checksum',type:'scan',sub:'GPG sign + SHA256'},
    {id:mk('a1'),label:'Burn to Media',type:'artifact',sub:'USB drive / DVD / tape'},{id:mk('g1'),label:'Chain of Custody',type:'gate',sub:'Physical handoff log'},
    {id:mk('sc2'),label:'Verify on Target',type:'scan',sub:'Checksum + signature verify'},{id:mk('d1'),label:'Install',type:'deploy',sub:'Offline install script'},
    {id:mk('t1'),label:'Acceptance Test',type:'test',sub:'Offline functional test'},
  ],edges:[{from:ids.s1,to:ids.sc1},{from:ids.sc1,to:ids.a1},{from:ids.a1,to:ids.g1},{from:ids.g1,to:ids.sc2},{from:ids.sc2,to:ids.d1},{from:ids.d1,to:ids.t1}],
})),
data_diode:()=>tpl((mk,ids)=>({
  name:'Data Diode Unidirectional Deployment',cat:'Air Gap',
  description:'One-way data flow through hardware data diode. Artifacts flow from low→high security domain. No return path.',
  nodes:[
    {id:mk('s1'),label:'Low-Side Build',type:'source',sub:'Standard CI/CD output'},{id:mk('sc1'),label:'Content Review',type:'scan',sub:'Manual + automated review'},
    {id:mk('a1'),label:'Package for Transfer',type:'artifact',sub:'Signed bundle'},{id:mk('d1'),label:'Data Diode',type:'deploy',sub:'Unidirectional hardware device'},
    {id:mk('sc2'),label:'High-Side Receive',type:'scan',sub:'Integrity verification'},{id:mk('d2'),label:'Install High-Side',type:'deploy',sub:'Classified environment deploy'},
    {id:mk('m1'),label:'Audit Log',type:'monitor',sub:'Transfer audit trail'},
  ],edges:[{from:ids.s1,to:ids.sc1},{from:ids.sc1,to:ids.a1},{from:ids.a1,to:ids.d1},{from:ids.d1,to:ids.sc2},{from:ids.sc2,to:ids.d2},{from:ids.d2,to:ids.m1}],
})),
local_mirror:()=>tpl((mk,ids)=>({
  name:'Local Private Registry Mirroring',cat:'Air Gap',
  description:'Mirror external registries to a local private registry inside the air-gapped network. Periodic sync via approved media.',
  nodes:[
    {id:mk('s1'),label:'External Registry',type:'source',sub:'Docker Hub / ECR / GHCR'},{id:mk('a1'),label:'Mirror Snapshot',type:'artifact',sub:'skopeo sync / crane copy'},
    {id:mk('sc1'),label:'Vulnerability Scan',type:'scan',sub:'Trivy offline DB scan'},{id:mk('g1'),label:'Transfer Gate',type:'gate',sub:'Approved media transfer'},
    {id:mk('d1'),label:'Load to Local Registry',type:'deploy',sub:'Harbor / Artifactory (air-gapped)'},{id:mk('t1'),label:'Image Pull Test',type:'test',sub:'K8s can pull from local'},
  ],edges:[{from:ids.s1,to:ids.a1},{from:ids.a1,to:ids.sc1},{from:ids.sc1,to:ids.g1},{from:ids.g1,to:ids.d1},{from:ids.d1,to:ids.t1}],
})),
pre_validated:()=>tpl((mk,ids)=>({
  name:'Pre-Validated Bundle Deployment',cat:'Air Gap',
  description:'Complete deployment bundle pre-validated and sealed in connected environment. Transferred as atomic unit to air-gapped target.',
  nodes:[
    {id:mk('s1'),label:'Build Bundle',type:'source',sub:'App + deps + config + scripts'},{id:mk('t1'),label:'Full Validation',type:'test',sub:'Complete test suite in staging'},
    {id:mk('sc1'),label:'Security Audit',type:'scan',sub:'SAST + SCA + compliance'},{id:mk('a1'),label:'Seal Bundle',type:'artifact',sub:'Signed + versioned + checksummed'},
    {id:mk('g1'),label:'Transfer',type:'gate',sub:'Physical media / data diode'},{id:mk('d1'),label:'Unpack + Deploy',type:'deploy',sub:'Atomic install on target'},
    {id:mk('m1'),label:'Post-Deploy Verify',type:'monitor',sub:'Health + acceptance + audit'},
  ],edges:[{from:ids.s1,to:ids.t1},{from:ids.t1,to:ids.sc1},{from:ids.sc1,to:ids.a1},{from:ids.a1,to:ids.g1},{from:ids.g1,to:ids.d1},{from:ids.d1,to:ids.m1}],
})),
};

export const DEPLOY_NODE_COLORS = {gate:'#ff3b5c',source:'#a29bfe',build:'#6c5ce7',test:'#ffd166',scan:'#fd79a8',artifact:'#ff8c42',deploy:'#00cec9',approve:'#e17055',monitor:'#55efc4',release:'#74b9ff',custom:'#636e72'};
export const DEPLOY_NODE_ICONS = {gate:'🚧',source:'📂',build:'🔨',test:'🧪',scan:'🔍',artifact:'📦',deploy:'🚀',approve:'✅',monitor:'📡',release:'🏷️',custom:'⚙️'};

export const DEPLOY_TEMPLATE_LIST = [
  {key:'standard_cd',icon:'🔄',cat:'Standard'},{key:'blue_green',icon:'🔵',cat:'Standard'},{key:'rolling',icon:'📶',cat:'Standard'},
  {key:'canary',icon:'🐤',cat:'Standard'},{key:'recreate',icon:'♻️',cat:'Standard'},{key:'big_bang',icon:'💥',cat:'Standard'},
  {key:'shadow',icon:'👤',cat:'Advanced'},{key:'ab_testing',icon:'🅰️',cat:'Advanced'},
  {key:'iac_immutable',icon:'🏗️',cat:'Advanced'},{key:'gitops_reconcile',icon:'♾️',cat:'Advanced'},
  {key:'cloud_bursting',icon:'☁️',cat:'Hybrid'},{key:'multi_cluster',icon:'🌐',cat:'Hybrid'},
  {key:'edge_deploy',icon:'📡',cat:'Hybrid'},{key:'policy_placement',icon:'📋',cat:'Hybrid'},
  {key:'sneakernet',icon:'💾',cat:'Air Gap'},{key:'data_diode',icon:'➡️',cat:'Air Gap'},
  {key:'local_mirror',icon:'🪞',cat:'Air Gap'},{key:'pre_validated',icon:'📦',cat:'Air Gap'},
];
