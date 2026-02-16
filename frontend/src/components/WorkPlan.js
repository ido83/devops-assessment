import React, { useState } from 'react';

const defaultWorkplan = {
  milestones: [
    { id: 1, name: 'Kickoff & Discovery', target: 'Week 1-2', owner: 'Lead Engineer', status: 'pending', deliverables: 'Gap analysis report, asset inventory, risk register' },
    { id: 2, name: 'Foundation Security Controls', target: 'Week 3-5', owner: 'DevSecOps Team', status: 'pending', deliverables: 'Secrets vault, RBAC policies, base image hardening' },
    { id: 3, name: 'Pipeline & Supply Chain', target: 'Week 4-7', owner: 'CI/CD Engineer', status: 'pending', deliverables: 'SAST/DAST integration, SBOM generation, artifact signing' },
    { id: 4, name: 'Runtime & Monitoring', target: 'Week 6-9', owner: 'SRE Team', status: 'pending', deliverables: 'SIEM integration, Falco rules, SLI/SLO dashboards' },
    { id: 5, name: 'Compliance & Documentation', target: 'Week 8-10', owner: 'Compliance Lead', status: 'pending', deliverables: 'Policy docs, CIS benchmark reports, runbooks' },
    { id: 6, name: 'Handoff & Training', target: 'Week 11-12', owner: 'Lead Engineer', status: 'pending', deliverables: 'Training sessions, operational handoff, final report' },
  ],
  teamRoles: [
    { role: 'DevSecOps Lead', count: 1, responsibilities: 'Architecture, oversight, stakeholder comms' },
    { role: 'Pipeline Engineer', count: 1, responsibilities: 'CI/CD hardening, SAST/DAST, artifact management' },
    { role: 'K8s/Cloud Engineer', count: 1, responsibilities: 'Cluster security, network policies, IaC' },
    { role: 'SRE / Monitoring', count: 1, responsibilities: 'Observability, incident response, SLOs' },
  ],
  riskItems: [
    { risk: 'Legacy systems incompatible with new controls', impact: 'high', mitigation: 'Parallel rollout with fallback' },
    { risk: 'Team skill gaps in security tooling', impact: 'medium', mitigation: 'Dedicated training sprints' },
    { risk: 'Third-party dependency vulnerabilities', impact: 'high', mitigation: 'SCA scanning + private registry proxy' },
  ]
};

const WorkPlan = ({ workplan, setWorkplan }) => {
  const wp = { ...defaultWorkplan, ...workplan };
  const [editMilestone, setEditMilestone] = useState(null);

  const updMilestone = (id, field, value) => {
    const ms = wp.milestones.map(m => m.id === id ? { ...m, [field]: value } : m);
    setWorkplan({ ...wp, milestones: ms });
  };

  const addMilestone = () => {
    const id = Math.max(0, ...wp.milestones.map(m => m.id)) + 1;
    const ms = [...wp.milestones, { id, name: 'New Milestone', target: '', owner: '', status: 'pending', deliverables: '' }];
    setWorkplan({ ...wp, milestones: ms });
    setEditMilestone(id);
  };

  const removeMilestone = (id) => {
    setWorkplan({ ...wp, milestones: wp.milestones.filter(m => m.id !== id) });
    setEditMilestone(null);
  };

  const updRole = (idx, field, value) => {
    const r = [...wp.teamRoles];
    r[idx] = { ...r[idx], [field]: value };
    setWorkplan({ ...wp, teamRoles: r });
  };

  const addRole = () => {
    setWorkplan({ ...wp, teamRoles: [...wp.teamRoles, { role: 'New Role', count: 1, responsibilities: '' }] });
  };

  const updRisk = (idx, field, value) => {
    const r = [...wp.riskItems];
    r[idx] = { ...r[idx], [field]: value };
    setWorkplan({ ...wp, riskItems: r });
  };

  const statusColors = { pending: 'var(--text-muted)', 'in-progress': 'var(--severity-medium)', done: 'var(--accent-secondary)', blocked: 'var(--severity-critical)' };

  return (
    <div className="animate-in">
      <div className="section-header">
        <h2>DevOps Working Plan</h2>
        <p>Define milestones, team structure, and risk mitigation for the remediation effort.</p>
      </div>

      {/* Milestones */}
      <div className="wp-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="wp-section-title">📍 Milestones</h3>
          <button className="btn btn-ghost" onClick={addMilestone}>+ Add</button>
        </div>
        <div className="wp-milestones">
          {wp.milestones.map((m, idx) => (
            <div key={m.id} className={`wp-milestone-card ${editMilestone === m.id ? 'editing' : ''}`}>
              <div className="wp-ms-header" onClick={() => setEditMilestone(editMilestone === m.id ? null : m.id)}>
                <div className="wp-ms-num">{idx + 1}</div>
                <div className="wp-ms-info">
                  <div className="wp-ms-name">{m.name}</div>
                  <div className="wp-ms-meta">
                    <span>{m.target}</span>
                    <span style={{ color: 'var(--text-accent)' }}>{m.owner}</span>
                  </div>
                </div>
                <select value={m.status} onClick={e => e.stopPropagation()} onChange={e => updMilestone(m.id, 'status', e.target.value)}
                  style={{ padding: '4px 10px', background: 'var(--bg-input)', border: `1px solid ${statusColors[m.status]}`, borderRadius: 20, color: statusColors[m.status], fontFamily: "'JetBrains Mono',monospace", fontSize: 11, cursor: 'pointer', outline: 'none' }}>
                  <option value="pending">Pending</option><option value="in-progress">In Progress</option><option value="done">Done</option><option value="blocked">Blocked</option>
                </select>
              </div>
              {editMilestone === m.id && (
                <div className="wp-ms-edit">
                  <div className="config-grid" style={{ gap: 12 }}>
                    <div className="config-field"><label>Name</label><input value={m.name} onChange={e => updMilestone(m.id, 'name', e.target.value)} /></div>
                    <div className="config-field"><label>Target</label><input value={m.target} onChange={e => updMilestone(m.id, 'target', e.target.value)} /></div>
                    <div className="config-field"><label>Owner</label><input value={m.owner} onChange={e => updMilestone(m.id, 'owner', e.target.value)} /></div>
                    <div className="config-field full-width"><label>Deliverables</label><textarea value={m.deliverables} onChange={e => updMilestone(m.id, 'deliverables', e.target.value)} /></div>
                  </div>
                  <button className="btn btn-ghost" style={{ color: 'var(--severity-critical)', marginTop: 8, fontSize: 12 }} onClick={() => removeMilestone(m.id)}>Delete Milestone</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Team */}
      <div className="wp-section" style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="wp-section-title">👥 Team Structure</h3>
          <button className="btn btn-ghost" onClick={addRole}>+ Add Role</button>
        </div>
        <div className="assessment-table">
          <table>
            <thead><tr><th>Role</th><th style={{ width: 80 }}>Count</th><th>Responsibilities</th></tr></thead>
            <tbody>
              {wp.teamRoles.map((r, i) => (
                <tr key={i}>
                  <td><input type="text" value={r.role} onChange={e => updRole(i, 'role', e.target.value)} className="inline-input" /></td>
                  <td><input type="number" min="1" value={r.count} onChange={e => updRole(i, 'count', Number(e.target.value))} className="inline-input" style={{ width: 50, textAlign: 'center' }} /></td>
                  <td><input type="text" value={r.responsibilities} onChange={e => updRole(i, 'responsibilities', e.target.value)} className="inline-input" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono',monospace" }}>
          Total headcount: {wp.teamRoles.reduce((s, r) => s + (r.count || 0), 0)}
        </div>
      </div>

      {/* Risks */}
      <div className="wp-section" style={{ marginTop: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 className="wp-section-title">⚠️ Risk Register</h3>
          <button className="btn btn-ghost" onClick={() => setWorkplan({ ...wp, riskItems: [...wp.riskItems, { risk: '', impact: 'medium', mitigation: '' }] })}>+ Add Risk</button>
        </div>
        <div className="assessment-table">
          <table>
            <thead><tr><th>Risk</th><th style={{ width: 100 }}>Impact</th><th>Mitigation</th></tr></thead>
            <tbody>
              {wp.riskItems.map((r, i) => (
                <tr key={i}>
                  <td><input type="text" value={r.risk} onChange={e => updRisk(i, 'risk', e.target.value)} className="inline-input" /></td>
                  <td>
                    <select value={r.impact} onChange={e => updRisk(i, 'impact', e.target.value)} className={`status-select ${r.impact === 'high' ? 'fail' : r.impact === 'medium' ? 'partial' : ''}`}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                    </select>
                  </td>
                  <td><input type="text" value={r.mitigation} onChange={e => updRisk(i, 'mitigation', e.target.value)} className="inline-input" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default WorkPlan;
