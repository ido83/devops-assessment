/* ═══════════ CI/CD PIPELINE TEMPLATES ═══════════
   Each template returns { name, description, tags:[], nodes:[], edges:[] }
   Tags: ci, cd, cloud-native, on-premise, air-gapped, gitops, monolith, microservice
*/
import { mkId } from '../utils/graphEngine';

function tpl(fn) {
  const ids = {}; const mk = (k) => { ids[k] = mkId(); return ids[k]; };
  return fn(mk, ids);
}

export const CICD_TEMPLATES = {
  naive_ci: () => tpl((mk, ids) => ({
    name: 'Classic CI Pipeline', description: 'Linear CI — checkout, build, test, scan, publish',
    tags: ['ci','cloud-native','on-premise','monolith','microservice'],
    nodes: [
      { id:mk('g1'), label:'Approval Gate', type:'gate', sub:'Manual / Policy check' },
      { id:mk('g2'), label:'Security Gate', type:'gate', sub:'Branch protection & MFA' },
      { id:mk('s1'), label:'Checkout', type:'source', sub:'git clone / SCM' },
      { id:mk('b1'), label:'Install Deps', type:'build', sub:'npm install / pip install' },
      { id:mk('t1'), label:'Lint', type:'test', sub:'ESLint / Pylint' },
      { id:mk('t2'), label:'Unit Tests', type:'test', sub:'Jest / PyTest' },
      { id:mk('sc1'), label:'SAST Scan', type:'scan', sub:'Semgrep / CodeQL' },
      { id:mk('sc2'), label:'SCA Scan', type:'scan', sub:'Snyk / Trivy' },
      { id:mk('b2'), label:'Build Artifact', type:'build', sub:'docker build / go build' },
      { id:mk('a1'), label:'Publish', type:'artifact', sub:'Push to registry' },
    ],
    edges: [
      {from:ids.g1,to:ids.g2},{from:ids.g2,to:ids.s1},{from:ids.s1,to:ids.b1},
      {from:ids.b1,to:ids.t1},{from:ids.b1,to:ids.t2},
      {from:ids.t1,to:ids.sc1},{from:ids.t2,to:ids.sc2},
      {from:ids.sc1,to:ids.b2},{from:ids.sc2,to:ids.b2},{from:ids.b2,to:ids.a1},
    ],
  })),

  gitops_helm_argocd: () => tpl((mk, ids) => ({
    name: 'GitOps — Helm + ArgoCD', description: 'GitOps CI/CD with Helm charts and ArgoCD sync',
    tags: ['ci','cd','cloud-native','gitops','microservice'],
    nodes: [
      { id:mk('g1'), label:'Policy Gate', type:'gate', sub:'OPA / Kyverno' },
      { id:mk('g2'), label:'PR Approval', type:'gate', sub:'CODEOWNERS review' },
      { id:mk('s1'), label:'Source', type:'source', sub:'Application repo' },
      { id:mk('b1'), label:'Build & Test', type:'build', sub:'Compile + unit test' },
      { id:mk('sc1'), label:'SAST', type:'scan', sub:'Semgrep / SonarQube' },
      { id:mk('sc2'), label:'Image Scan', type:'scan', sub:'Trivy container scan' },
      { id:mk('a1'), label:'Sign & Push', type:'artifact', sub:'Cosign + OCI registry' },
      { id:mk('d1'), label:'Update Helm Values', type:'deploy', sub:'Bump image tag in GitOps repo' },
      { id:mk('m1'), label:'ArgoCD Sync', type:'monitor', sub:'Detect drift + auto-sync' },
      { id:mk('d2'), label:'K8s Deploy', type:'deploy', sub:'Helm upgrade via ArgoCD' },
      { id:mk('m2'), label:'Health Check', type:'monitor', sub:'Readiness + liveness' },
      { id:mk('r1'), label:'Release', type:'release', sub:'Git tag + SLSA provenance' },
    ],
    edges: [
      {from:ids.g1,to:ids.g2},{from:ids.g2,to:ids.s1},{from:ids.s1,to:ids.b1},
      {from:ids.b1,to:ids.sc1},{from:ids.b1,to:ids.sc2},
      {from:ids.sc1,to:ids.a1},{from:ids.sc2,to:ids.a1},
      {from:ids.a1,to:ids.d1},{from:ids.d1,to:ids.m1},{from:ids.m1,to:ids.d2},
      {from:ids.d2,to:ids.m2},{from:ids.m2,to:ids.r1},
    ],
  })),

  argocd_appset: () => tpl((mk, ids) => ({
    name: 'ArgoCD ApplicationSet — Apps of Apps', description: 'Multi-env promotion via ArgoCD ApplicationSet pattern',
    tags: ['cd','cloud-native','gitops','microservice'],
    nodes: [
      { id:mk('g1'), label:'Merge Gate', type:'gate', sub:'PR merged to main' },
      { id:mk('s1'), label:'App-of-Apps Repo', type:'source', sub:'Root ApplicationSet YAML' },
      { id:mk('a1'), label:'Generate Apps', type:'build', sub:'ApplicationSet controller' },
      { id:mk('d1'), label:'Deploy Dev', type:'deploy', sub:'ArgoCD sync → dev ns' },
      { id:mk('t1'), label:'Integration Test', type:'test', sub:'Automated e2e in dev' },
      { id:mk('ap1'), label:'Promote to Staging', type:'approve', sub:'Manual approval gate' },
      { id:mk('d2'), label:'Deploy Staging', type:'deploy', sub:'ArgoCD sync → staging ns' },
      { id:mk('t2'), label:'Smoke Test', type:'test', sub:'Staging validation' },
      { id:mk('ap2'), label:'Promote to Prod', type:'approve', sub:'Change management approval' },
      { id:mk('d3'), label:'Deploy Prod', type:'deploy', sub:'ArgoCD sync → prod ns' },
      { id:mk('m1'), label:'Monitor', type:'monitor', sub:'Metrics + alerts' },
    ],
    edges: [
      {from:ids.g1,to:ids.s1},{from:ids.s1,to:ids.a1},{from:ids.a1,to:ids.d1},
      {from:ids.d1,to:ids.t1},{from:ids.t1,to:ids.ap1},{from:ids.ap1,to:ids.d2},
      {from:ids.d2,to:ids.t2},{from:ids.t2,to:ids.ap2},{from:ids.ap2,to:ids.d3},
      {from:ids.d3,to:ids.m1},
    ],
  })),

  aws_cicd: () => tpl((mk, ids) => ({
    name: 'AWS CI/CD (CodePipeline)', description: 'AWS-native CI/CD with CodeCommit, CodeBuild, CodeDeploy, ECR',
    tags: ['ci','cd','cloud-native','microservice','monolith'],
    nodes: [
      { id:mk('g1'), label:'Branch Rule', type:'gate', sub:'CodeCommit branch policy' },
      { id:mk('s1'), label:'CodeCommit', type:'source', sub:'AWS CodeCommit / GitHub' },
      { id:mk('b1'), label:'CodeBuild CI', type:'build', sub:'buildspec.yml — compile & test' },
      { id:mk('sc1'), label:'CodeGuru Review', type:'scan', sub:'Automated code review' },
      { id:mk('sc2'), label:'ECR Scan', type:'scan', sub:'Container vulnerability scan' },
      { id:mk('a1'), label:'Push to ECR', type:'artifact', sub:'Docker image → ECR' },
      { id:mk('ap1'), label:'Manual Approval', type:'approve', sub:'SNS notification' },
      { id:mk('d1'), label:'CodeDeploy Staging', type:'deploy', sub:'ECS/EKS blue-green' },
      { id:mk('t1'), label:'Integration Test', type:'test', sub:'Lambda test suite' },
      { id:mk('d2'), label:'CodeDeploy Prod', type:'deploy', sub:'ECS/EKS canary deploy' },
      { id:mk('m1'), label:'CloudWatch', type:'monitor', sub:'Alarms + X-Ray traces' },
    ],
    edges: [
      {from:ids.g1,to:ids.s1},{from:ids.s1,to:ids.b1},
      {from:ids.b1,to:ids.sc1},{from:ids.b1,to:ids.sc2},
      {from:ids.sc1,to:ids.a1},{from:ids.sc2,to:ids.a1},
      {from:ids.a1,to:ids.ap1},{from:ids.ap1,to:ids.d1},{from:ids.d1,to:ids.t1},
      {from:ids.t1,to:ids.d2},{from:ids.d2,to:ids.m1},
    ],
  })),

  mlops: () => tpl((mk, ids) => ({
    name: 'MLOps CI/CD Pipeline', description: 'ML model training, validation, registry, and deployment',
    tags: ['ci','cd','cloud-native','on-premise','microservice'],
    nodes: [
      { id:mk('g1'), label:'Data Gate', type:'gate', sub:'Data quality validation' },
      { id:mk('s1'), label:'Source + Data', type:'source', sub:'Model code + training data' },
      { id:mk('b1'), label:'Feature Eng.', type:'build', sub:'Feature store / transform' },
      { id:mk('t1'), label:'Train Model', type:'test', sub:'Training pipeline (SageMaker/Vertex)' },
      { id:mk('sc1'), label:'Model Validation', type:'scan', sub:'Accuracy, bias, drift checks' },
      { id:mk('sc2'), label:'Security Scan', type:'scan', sub:'Scan model dependencies' },
      { id:mk('a1'), label:'Model Registry', type:'artifact', sub:'MLflow / Vertex / SageMaker' },
      { id:mk('ap1'), label:'Review Gate', type:'approve', sub:'ML engineer approval' },
      { id:mk('d1'), label:'Deploy Endpoint', type:'deploy', sub:'Inference endpoint (A/B test)' },
      { id:mk('m1'), label:'Monitor Drift', type:'monitor', sub:'Data drift + prediction monitoring' },
      { id:mk('b2'), label:'Retrain Trigger', type:'build', sub:'Auto-retrain on drift alert' },
    ],
    edges: [
      {from:ids.g1,to:ids.s1},{from:ids.s1,to:ids.b1},{from:ids.b1,to:ids.t1},
      {from:ids.t1,to:ids.sc1},{from:ids.t1,to:ids.sc2},
      {from:ids.sc1,to:ids.a1},{from:ids.sc2,to:ids.a1},
      {from:ids.a1,to:ids.ap1},{from:ids.ap1,to:ids.d1},{from:ids.d1,to:ids.m1},
      {from:ids.m1,to:ids.b2},
    ],
  })),

  aiops: () => tpl((mk, ids) => ({
    name: 'AIOps CI/CD Pipeline', description: 'AI-driven ops — auto-remediation, anomaly detection, intelligent deploy',
    tags: ['ci','cd','cloud-native','microservice'],
    nodes: [
      { id:mk('g1'), label:'AI Risk Gate', type:'gate', sub:'AI risk scoring on change' },
      { id:mk('s1'), label:'Source', type:'source', sub:'App + AI agent code' },
      { id:mk('b1'), label:'Build & Test', type:'build', sub:'Standard CI pipeline' },
      { id:mk('sc1'), label:'AI Code Review', type:'scan', sub:'AI-powered code analysis' },
      { id:mk('a1'), label:'Artifact + Model', type:'artifact', sub:'App image + AI model bundle' },
      { id:mk('d1'), label:'AI Canary Deploy', type:'deploy', sub:'AI-driven traffic shifting' },
      { id:mk('m1'), label:'Anomaly Detection', type:'monitor', sub:'AI monitoring (Dynatrace/Moogsoft)' },
      { id:mk('b2'), label:'Auto-Remediate', type:'build', sub:'AI-triggered rollback/scale' },
      { id:mk('m2'), label:'Feedback Loop', type:'monitor', sub:'Learn from incidents → improve' },
    ],
    edges: [
      {from:ids.g1,to:ids.s1},{from:ids.s1,to:ids.b1},{from:ids.b1,to:ids.sc1},
      {from:ids.sc1,to:ids.a1},{from:ids.a1,to:ids.d1},{from:ids.d1,to:ids.m1},
      {from:ids.m1,to:ids.b2},{from:ids.b2,to:ids.m2},{from:ids.m2,to:ids.d1},
    ],
  })),

  artifactory_vm: () => tpl((mk, ids) => ({
    name: 'CD — Artifactory to VM', description: 'Download from Artifactory and deploy to Linux/Windows VMs',
    tags: ['cd','on-premise','monolith','microservice'],
    nodes: [
      { id:mk('g1'), label:'Change Approval', type:'gate', sub:'CAB / Change ticket' },
      { id:mk('g2'), label:'Security Gate', type:'gate', sub:'Vuln threshold check' },
      { id:mk('a1'), label:'Fetch Artifact', type:'artifact', sub:'Download from Artifactory' },
      { id:mk('sc1'), label:'Verify Checksum', type:'scan', sub:'SHA256 + signature' },
      { id:mk('b1'), label:'Pre-deploy Backup', type:'build', sub:'Snapshot current state' },
      { id:mk('d1'), label:'Deploy VM-1', type:'deploy', sub:'Ansible / SSH' },
      { id:mk('d2'), label:'Deploy VM-2', type:'deploy', sub:'Ansible / SSH' },
      { id:mk('b2'), label:'Config Inject', type:'build', sub:'Env config overlay' },
      { id:mk('t1'), label:'Smoke Test', type:'test', sub:'Health + e2e' },
      { id:mk('m1'), label:'Monitor', type:'monitor', sub:'Metrics + logs' },
    ],
    edges: [
      {from:ids.g1,to:ids.g2},{from:ids.g2,to:ids.a1},{from:ids.a1,to:ids.sc1},
      {from:ids.sc1,to:ids.b1},
      {from:ids.b1,to:ids.d1},{from:ids.b1,to:ids.d2},
      {from:ids.d1,to:ids.b2},{from:ids.d2,to:ids.b2},
      {from:ids.b2,to:ids.t1},{from:ids.t1,to:ids.m1},
    ],
  })),

  airgap_linux: () => tpl((mk, ids) => ({
    name: 'Air-Gapped CD — Linux (tar.gz)', description: 'Air-gapped: copy tarball → extract → run auto script → deploy on Linux',
    tags: ['cd','air-gapped','on-premise','monolith'],
    nodes: [
      { id:mk('g1'), label:'Approval Gate', type:'gate', sub:'Offline change approval' },
      { id:mk('a1'), label:'Copy Tarball', type:'artifact', sub:'USB/DVD/SFTP transfer .tar.gz' },
      { id:mk('sc1'), label:'Verify Integrity', type:'scan', sub:'SHA256 checksum + GPG sig' },
      { id:mk('b1'), label:'Extract Archive', type:'build', sub:'tar -xzf package.tar.gz' },
      { id:mk('b2'), label:'Run Install Script', type:'build', sub:'./install.sh --auto' },
      { id:mk('b3'), label:'Config Overlay', type:'build', sub:'Apply env-specific config' },
      { id:mk('d1'), label:'Deploy Service', type:'deploy', sub:'systemctl restart app' },
      { id:mk('t1'), label:'Health Check', type:'test', sub:'curl localhost:port/health' },
      { id:mk('m1'), label:'Verify Logs', type:'monitor', sub:'journalctl + app logs' },
    ],
    edges: [
      {from:ids.g1,to:ids.a1},{from:ids.a1,to:ids.sc1},{from:ids.sc1,to:ids.b1},
      {from:ids.b1,to:ids.b2},{from:ids.b2,to:ids.b3},{from:ids.b3,to:ids.d1},
      {from:ids.d1,to:ids.t1},{from:ids.t1,to:ids.m1},
    ],
  })),

  airgap_windows: () => tpl((mk, ids) => ({
    name: 'Air-Gapped CD — Windows (MSI)', description: 'Air-gapped: copy ZIP → extract → silent MSI install → deploy on Windows',
    tags: ['cd','air-gapped','on-premise','monolith'],
    nodes: [
      { id:mk('g1'), label:'Approval Gate', type:'gate', sub:'Offline change approval' },
      { id:mk('a1'), label:'Copy ZIP', type:'artifact', sub:'USB/network share .zip' },
      { id:mk('sc1'), label:'Verify Signature', type:'scan', sub:'Authenticode / checksum' },
      { id:mk('b1'), label:'Extract ZIP', type:'build', sub:'Expand-Archive -Path pkg.zip' },
      { id:mk('b2'), label:'Silent Install MSI', type:'build', sub:'msiexec /i app.msi /qn' },
      { id:mk('b3'), label:'Apply Config', type:'build', sub:'Merge env XML/JSON config' },
      { id:mk('d1'), label:'Restart Service', type:'deploy', sub:'Restart-Service AppSvc' },
      { id:mk('t1'), label:'Health Check', type:'test', sub:'Invoke-WebRequest /health' },
      { id:mk('m1'), label:'Event Log', type:'monitor', sub:'Check Windows Event Viewer' },
    ],
    edges: [
      {from:ids.g1,to:ids.a1},{from:ids.a1,to:ids.sc1},{from:ids.sc1,to:ids.b1},
      {from:ids.b1,to:ids.b2},{from:ids.b2,to:ids.b3},{from:ids.b3,to:ids.d1},
      {from:ids.d1,to:ids.t1},{from:ids.t1,to:ids.m1},
    ],
  })),

  multi_microservice: () => tpl((mk, ids) => ({
    name: 'Multi-Microservice Promotion', description: 'Promote multiple services through dev → staging → prod with gates',
    tags: ['ci','cd','cloud-native','microservice'],
    nodes: [
      { id:mk('g1'), label:'PR Gate', type:'gate', sub:'All services pass CI' },
      { id:mk('s1'), label:'Service A CI', type:'source', sub:'Svc-A build + test' },
      { id:mk('s2'), label:'Service B CI', type:'source', sub:'Svc-B build + test' },
      { id:mk('s3'), label:'Service C CI', type:'source', sub:'Svc-C build + test' },
      { id:mk('a1'), label:'Push Images', type:'artifact', sub:'All images → registry' },
      { id:mk('d1'), label:'Deploy Dev', type:'deploy', sub:'All services → dev env' },
      { id:mk('t1'), label:'Contract Tests', type:'test', sub:'Service mesh integration' },
      { id:mk('ap1'), label:'Promote Staging', type:'approve', sub:'QA approval' },
      { id:mk('d2'), label:'Deploy Staging', type:'deploy', sub:'Canary rollout staging' },
      { id:mk('ap2'), label:'Promote Prod', type:'approve', sub:'Release manager' },
      { id:mk('d3'), label:'Deploy Prod', type:'deploy', sub:'Rolling deploy prod' },
    ],
    edges: [
      {from:ids.g1,to:ids.s1},{from:ids.g1,to:ids.s2},{from:ids.g1,to:ids.s3},
      {from:ids.s1,to:ids.a1},{from:ids.s2,to:ids.a1},{from:ids.s3,to:ids.a1},
      {from:ids.a1,to:ids.d1},{from:ids.d1,to:ids.t1},{from:ids.t1,to:ids.ap1},
      {from:ids.ap1,to:ids.d2},{from:ids.d2,to:ids.ap2},{from:ids.ap2,to:ids.d3},
    ],
  })),

  hybrid_aws_airgap: () => tpl((mk, ids) => ({
    name: 'Hybrid Cloud — AWS to Air-Gapped', description: 'CI in AWS cloud, CD through data diode / approved media to air-gapped on-prem environment',
    tags: ['ci','cd','cloud-native','air-gapped','on-premise'],
    nodes: [
      { id:mk('s1'), label:'CodeCommit', type:'source', sub:'AWS cloud repo' },
      { id:mk('b1'), label:'CodeBuild CI', type:'build', sub:'Build + test in AWS' },
      { id:mk('sc1'), label:'ECR Scan', type:'scan', sub:'Container vuln scan' },
      { id:mk('a1'), label:'Push to ECR', type:'artifact', sub:'Docker image → ECR' },
      { id:mk('a2'), label:'Export Bundle', type:'artifact', sub:'skopeo copy + sign tarball' },
      { id:mk('sc2'), label:'Sign & Checksum', type:'scan', sub:'Cosign + SHA256' },
      { id:mk('g1'), label:'Transfer Gate', type:'gate', sub:'Data diode / USB media' },
      { id:mk('sc3'), label:'Verify on Target', type:'scan', sub:'Checksum + signature verify' },
      { id:mk('d1'), label:'Load Local Registry', type:'deploy', sub:'Harbor / Artifactory (air-gapped)' },
      { id:mk('d2'), label:'Deploy to K8s', type:'deploy', sub:'ArgoCD local sync' },
      { id:mk('t1'), label:'Acceptance Test', type:'test', sub:'Offline functional test' },
      { id:mk('m1'), label:'Monitor', type:'monitor', sub:'Local Prometheus + Grafana' },
    ],
    edges: [
      {from:ids.s1,to:ids.b1},{from:ids.b1,to:ids.sc1},{from:ids.sc1,to:ids.a1},
      {from:ids.a1,to:ids.a2},{from:ids.a2,to:ids.sc2},{from:ids.sc2,to:ids.g1},
      {from:ids.g1,to:ids.sc3},{from:ids.sc3,to:ids.d1},{from:ids.d1,to:ids.d2},
      {from:ids.d2,to:ids.t1},{from:ids.t1,to:ids.m1},
    ],
  })),
};

/* Template metadata for picker UI */
export const CICD_TEMPLATE_LIST = [
  { key:'naive_ci', icon:'⛓️', cat:'CI' },
  { key:'gitops_helm_argocd', icon:'☸️', cat:'CI/CD' },
  { key:'argocd_appset', icon:'🔄', cat:'CD' },
  { key:'aws_cicd', icon:'☁️', cat:'CI/CD' },
  { key:'mlops', icon:'🧠', cat:'CI/CD' },
  { key:'aiops', icon:'🤖', cat:'CI/CD' },
  { key:'artifactory_vm', icon:'🏢', cat:'CD' },
  { key:'airgap_linux', icon:'🐧', cat:'CD' },
  { key:'airgap_windows', icon:'🪟', cat:'CD' },
  { key:'multi_microservice', icon:'🔀', cat:'CI/CD' },
  { key:'hybrid_aws_airgap', icon:'🔒', cat:'Hybrid' },
];
