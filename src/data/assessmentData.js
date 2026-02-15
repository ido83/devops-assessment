export const assessmentCategories = [
  {
    id: 'ci-cd',
    title: 'CI/CD Pipeline Security',
    icon: '⛓️',
    description: 'Continuous integration and delivery pipeline hardening and security controls.',
    items: [
      { id: 'ci-1', text: 'Pipeline-as-code stored in version control with branch protection', severity: 'critical', tags: ['devsecops'] },
      { id: 'ci-2', text: 'Secrets management via vault (HashiCorp Vault, AWS Secrets Manager) — no hardcoded credentials', severity: 'critical', tags: ['devsecops'] },
      { id: 'ci-3', text: 'Automated SAST/DAST scanning integrated in pipeline stages', severity: 'critical', tags: ['devsecops'] },
      { id: 'ci-4', text: 'Dependency vulnerability scanning (SCA) on every build', severity: 'high', tags: ['devsecops'] },
      { id: 'ci-5', text: 'Artifact signing and provenance attestation (SLSA, Sigstore)', severity: 'high', tags: ['devsecops'] },
      { id: 'ci-6', text: 'Pipeline execution with least-privilege service accounts', severity: 'high', tags: ['devsecops', 'devops'] },
      { id: 'ci-7', text: 'Build reproducibility and hermetic build environments', severity: 'medium', tags: ['devops'] },
      { id: 'ci-8', text: 'Automated rollback mechanisms on deployment failure', severity: 'medium', tags: ['devops'] },
      { id: 'ci-9', text: 'Multi-stage pipeline with gated approvals for production', severity: 'high', tags: ['devops'] },
      { id: 'ci-10', text: 'Pipeline audit logging and tamper-evident build records', severity: 'high', tags: ['devsecops'] },
    ]
  },
  {
    id: 'container-security',
    title: 'Container & Image Security',
    icon: '🐳',
    description: 'Container runtime security, image hardening, and registry policies.',
    items: [
      { id: 'cs-1', text: 'Base images from trusted registries with verified signatures', severity: 'critical', tags: ['devsecops'] },
      { id: 'cs-2', text: 'Container image vulnerability scanning (Trivy, Snyk, Grype)', severity: 'critical', tags: ['devsecops'] },
      { id: 'cs-3', text: 'Non-root container execution enforced by default', severity: 'critical', tags: ['devsecops'] },
      { id: 'cs-4', text: 'Read-only root filesystem where possible', severity: 'high', tags: ['devsecops'] },
      { id: 'cs-5', text: 'Minimal/distroless base images to reduce attack surface', severity: 'high', tags: ['devsecops', 'devops'] },
      { id: 'cs-6', text: 'Container resource limits (CPU, memory) defined', severity: 'medium', tags: ['devops'] },
      { id: 'cs-7', text: 'Private container registry with access controls and scanning policies', severity: 'high', tags: ['devops'] },
      { id: 'cs-8', text: 'Runtime security monitoring (Falco, Sysdig)', severity: 'high', tags: ['devsecops'] },
      { id: 'cs-9', text: 'Image layer caching strategy for build performance', severity: 'low', tags: ['devops'] },
      { id: 'cs-10', text: 'Immutable container tags — no "latest" tag in production', severity: 'medium', tags: ['devops', 'devsecops'] },
    ]
  },
  {
    id: 'kubernetes',
    title: 'Kubernetes & Orchestration',
    icon: '☸️',
    description: 'Cluster security, RBAC, network policies, and workload hardening.',
    items: [
      { id: 'k8-1', text: 'RBAC configured with least-privilege roles and bindings', severity: 'critical', tags: ['devsecops'] },
      { id: 'k8-2', text: 'Network Policies enforce pod-to-pod traffic segmentation', severity: 'critical', tags: ['devsecops'] },
      { id: 'k8-3', text: 'Pod Security Standards (restricted profile) enforced', severity: 'critical', tags: ['devsecops'] },
      { id: 'k8-4', text: 'etcd encryption at rest enabled', severity: 'high', tags: ['devsecops'] },
      { id: 'k8-5', text: 'API server audit logging enabled and forwarded to SIEM', severity: 'high', tags: ['devsecops'] },
      { id: 'k8-6', text: 'Service mesh for mTLS between services (Istio, Linkerd)', severity: 'high', tags: ['devsecops'] },
      { id: 'k8-7', text: 'GitOps deployment model (ArgoCD, Flux) with drift detection', severity: 'medium', tags: ['devops'] },
      { id: 'k8-8', text: 'Horizontal Pod Autoscaling and cluster autoscaling configured', severity: 'medium', tags: ['devops'] },
      { id: 'k8-9', text: 'Admission controllers (OPA/Gatekeeper, Kyverno) for policy enforcement', severity: 'high', tags: ['devsecops'] },
      { id: 'k8-10', text: 'Regular CIS Kubernetes Benchmark compliance scans', severity: 'high', tags: ['devsecops'] },
    ]
  },
  {
    id: 'iac',
    title: 'Infrastructure as Code',
    icon: '🏗️',
    description: 'IaC security scanning, drift detection, and state management.',
    items: [
      { id: 'iac-1', text: 'IaC templates scanned for misconfigurations (Checkov, tfsec, KICS)', severity: 'critical', tags: ['devsecops'] },
      { id: 'iac-2', text: 'Terraform/Pulumi state encrypted and stored remotely with locking', severity: 'high', tags: ['devops'] },
      { id: 'iac-3', text: 'Module versioning and registry for reusable infrastructure components', severity: 'medium', tags: ['devops'] },
      { id: 'iac-4', text: 'Drift detection and automated reconciliation configured', severity: 'medium', tags: ['devops'] },
      { id: 'iac-5', text: 'Plan/apply separation with mandatory review on infrastructure changes', severity: 'high', tags: ['devops', 'devsecops'] },
      { id: 'iac-6', text: 'No secrets in IaC templates — dynamic secret injection only', severity: 'critical', tags: ['devsecops'] },
      { id: 'iac-7', text: 'Tagging strategy enforced for cost allocation and ownership', severity: 'low', tags: ['devops'] },
      { id: 'iac-8', text: 'Blast radius minimization via modular state separation', severity: 'medium', tags: ['devops'] },
    ]
  },
  {
    id: 'monitoring',
    title: 'Observability & Incident Response',
    icon: '📡',
    description: 'Monitoring, alerting, logging, and incident management practices.',
    items: [
      { id: 'mon-1', text: 'Centralized logging with structured log format (ELK, Loki, Datadog)', severity: 'high', tags: ['devops'] },
      { id: 'mon-2', text: 'Distributed tracing across services (Jaeger, Tempo, X-Ray)', severity: 'medium', tags: ['devops'] },
      { id: 'mon-3', text: 'SLI/SLO definitions with error budget tracking', severity: 'medium', tags: ['devops'] },
      { id: 'mon-4', text: 'Security event monitoring and SIEM integration', severity: 'critical', tags: ['devsecops'] },
      { id: 'mon-5', text: 'Runbooks for common incidents documented and tested', severity: 'medium', tags: ['devops'] },
      { id: 'mon-6', text: 'On-call rotation with escalation policies defined', severity: 'medium', tags: ['devops'] },
      { id: 'mon-7', text: 'Anomaly detection for security and performance events', severity: 'high', tags: ['devsecops'] },
      { id: 'mon-8', text: 'Log retention policies compliant with regulatory requirements', severity: 'high', tags: ['devsecops'] },
      { id: 'mon-9', text: 'Post-incident review (blameless postmortems) process in place', severity: 'medium', tags: ['devops'] },
      { id: 'mon-10', text: 'Chaos engineering practices for resilience validation', severity: 'low', tags: ['devops'] },
    ]
  },
  {
    id: 'access-control',
    title: 'Identity & Access Management',
    icon: '🔐',
    description: 'Authentication, authorization, and identity governance controls.',
    items: [
      { id: 'iam-1', text: 'SSO/SAML integration for all DevOps tooling', severity: 'high', tags: ['devsecops'] },
      { id: 'iam-2', text: 'MFA enforced for all privileged and production access', severity: 'critical', tags: ['devsecops'] },
      { id: 'iam-3', text: 'Just-in-time (JIT) access for production environments', severity: 'high', tags: ['devsecops'] },
      { id: 'iam-4', text: 'Service account credentials rotated automatically', severity: 'high', tags: ['devsecops'] },
      { id: 'iam-5', text: 'API key and token lifecycle management with expiration', severity: 'high', tags: ['devsecops'] },
      { id: 'iam-6', text: 'Quarterly access reviews for all infrastructure access', severity: 'medium', tags: ['devsecops'] },
      { id: 'iam-7', text: 'Break-glass procedure documented for emergency access', severity: 'medium', tags: ['devops', 'devsecops'] },
      { id: 'iam-8', text: 'Zero-trust network access (ZTNA) model implemented', severity: 'high', tags: ['devsecops'] },
    ]
  },
  {
    id: 'compliance',
    title: 'Compliance & Governance',
    icon: '📋',
    description: 'Regulatory compliance, audit readiness, and governance frameworks.',
    items: [
      { id: 'com-1', text: 'Software Bill of Materials (SBOM) generation for all releases', severity: 'high', tags: ['devsecops'] },
      { id: 'com-2', text: 'License compliance scanning for open-source dependencies', severity: 'medium', tags: ['devsecops'] },
      { id: 'com-3', text: 'Change management process with audit trail', severity: 'high', tags: ['devops', 'devsecops'] },
      { id: 'com-4', text: 'Data classification and handling policies enforced in pipelines', severity: 'high', tags: ['devsecops'] },
      { id: 'com-5', text: 'Regulatory framework mapping (SOC2, ISO27001, NIST, PCI-DSS)', severity: 'high', tags: ['devsecops'] },
      { id: 'com-6', text: 'Automated compliance-as-code checks in CI/CD', severity: 'medium', tags: ['devsecops'] },
      { id: 'com-7', text: 'Vulnerability disclosure and patching SLA defined', severity: 'high', tags: ['devsecops'] },
      { id: 'com-8', text: 'Third-party vendor security assessment process', severity: 'medium', tags: ['devsecops'] },
    ]
  },
  {
    id: 'supply-chain',
    title: 'Software Supply Chain',
    icon: '🔗',
    description: 'Supply chain integrity, dependency management, and provenance verification.',
    items: [
      { id: 'sc-1', text: 'Dependency pinning with lock files committed to VCS', severity: 'high', tags: ['devsecops'] },
      { id: 'sc-2', text: 'Private package registry/proxy for dependency caching and control', severity: 'medium', tags: ['devops', 'devsecops'] },
      { id: 'sc-3', text: 'SLSA framework adoption (Level 2+ build integrity)', severity: 'high', tags: ['devsecops'] },
      { id: 'sc-4', text: 'Automated dependency update PRs with vulnerability context (Renovate, Dependabot)', severity: 'medium', tags: ['devops'] },
      { id: 'sc-5', text: 'Typosquatting and malicious package detection controls', severity: 'high', tags: ['devsecops'] },
      { id: 'sc-6', text: 'Code signing for all release artifacts', severity: 'high', tags: ['devsecops'] },
      { id: 'sc-7', text: 'VCS branch protection with required reviews and status checks', severity: 'high', tags: ['devops', 'devsecops'] },
      { id: 'sc-8', text: 'Pre-commit hooks for secret detection and linting', severity: 'medium', tags: ['devsecops'] },
    ]
  }
];

export const severityConfig = {
  critical: { label: 'Critical', color: '#ff3b5c', weight: 4 },
  high:     { label: 'High',     color: '#ff8c42', weight: 3 },
  medium:   { label: 'Medium',   color: '#ffd166', weight: 2 },
  low:      { label: 'Low',      color: '#66d9c2', weight: 1 },
};

export const frameworkTemplates = [
  { id: 'full', name: 'Full Assessment', description: 'All categories — comprehensive DevOps & DevSecOps audit', filter: () => true },
  { id: 'devsecops', name: 'DevSecOps Focus', description: 'Security-centric items only', filter: (item) => item.tags.includes('devsecops') },
  { id: 'devops', name: 'DevOps Maturity', description: 'Operational maturity and reliability items', filter: (item) => item.tags.includes('devops') },
  { id: 'critical-only', name: 'Critical Controls', description: 'Critical and high severity items only', filter: (item) => item.severity === 'critical' || item.severity === 'high' },
  { id: 'supply-chain', name: 'Supply Chain Security', description: 'Software supply chain and dependency security', filter: (item) => item.tags.includes('devsecops') && ['sc-', 'ci-', 'cs-'].some(p => item.id.startsWith(p)) },
];
