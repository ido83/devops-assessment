import React from 'react';

const CURRENCIES = [
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
];

const defaultPricing = {
  engineers: 1,
  duration: 1,
  hourlyRate: 100,
  monthlyRate: 0,
  contingency: 15,
  totalCost: 0,
  currency: 'ILS',
  estimationMode: 'price', // 'price', 'percentage', 'both'
  phases: [
    { name: 'Assessment & Planning', percentage: 15, months: 1 },
    { name: 'CI/CD & Pipeline Hardening', percentage: 20, months: 1.5 },
    { name: 'Container & K8s Security', percentage: 25, months: 2 },
    { name: 'IAM & Access Controls', percentage: 15, months: 1 },
    { name: 'Monitoring & Compliance', percentage: 15, months: 1 },
    { name: 'Documentation & Handoff', percentage: 10, months: 0.5 },
  ],
};

const PricingStep = ({ pricing, setPricing, toast }) => {
  const p = { ...defaultPricing, ...pricing };
  const cur = CURRENCIES.find(c => c.code === p.currency) || CURRENCIES[0];

  const monthlyRate = p.hourlyRate * 160;
  const baseCost = monthlyRate * p.engineers * p.duration;
  const contingencyAmt = baseCost * (p.contingency / 100);
  const totalCost = baseCost + contingencyAmt;

  const upd = (field, value) => {
    const next = { ...p, [field]: value, monthlyRate, totalCost };
    setPricing(next);
  };

  const updPhase = (idx, field, value) => {
    const phases = [...(p.phases || defaultPricing.phases)];
    phases[idx] = { ...phases[idx], [field]: value };
    setPricing({ ...p, phases });
  };

  const addPhase = () => {
    const phases = [...(p.phases || []), { name: 'New Phase', percentage: 0, months: 1 }];
    setPricing({ ...p, phases });
    toast && toast('Phase added', 'success');
  };

  const removePhase = (idx) => {
    const phases = (p.phases || []).filter((_, i) => i !== idx);
    setPricing({ ...p, phases });
  };

  const totalPct = (p.phases || []).reduce((s, ph) => s + (Number(ph.percentage) || 0), 0);
  const fmt = (n) => cur.symbol + n.toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <div className="animate-in">
      <div className="section-header">
        <h2>Pricing & Resource Estimation</h2>
        <p>Estimate DevOps engineering effort, cost, and phase allocation.</p>
      </div>

      <div className="pricing-grid">
        <div className="pricing-card main-estimate">
          <h3>Resource Parameters</h3>
          <div className="pricing-fields">
            <div className="pricing-field">
              <label>Currency</label>
              <select value={p.currency} onChange={e => upd('currency', e.target.value)}
                style={{width:'100%',padding:'10px 14px',background:'var(--bg-input)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-primary)',fontFamily:"'JetBrains Mono',monospace",fontSize:15,outline:'none',cursor:'pointer'}}>
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            <div className="pricing-field">
              <label>DevOps Engineers</label>
              <input type="number" min="1" max="50" value={p.engineers} onChange={e => upd('engineers', Number(e.target.value))} />
            </div>
            <div className="pricing-field">
              <label>Duration (months)</label>
              <input type="number" min="1" max="60" value={p.duration} onChange={e => upd('duration', Number(e.target.value))} />
            </div>
            <div className="pricing-field">
              <label>Hourly Rate ({cur.symbol})</label>
              <input type="number" min="1" value={p.hourlyRate} onChange={e => upd('hourlyRate', Number(e.target.value))} />
            </div>
            <div className="pricing-field">
              <label>Contingency %</label>
              <input type="number" min="0" max="100" value={p.contingency} onChange={e => upd('contingency', Number(e.target.value))} />
            </div>
            <div className="pricing-field">
              <label>Estimation Display</label>
              <select value={p.estimationMode || 'price'} onChange={e => upd('estimationMode', e.target.value)}
                style={{width:'100%',padding:'10px 14px',background:'var(--bg-input)',border:'1px solid var(--border-subtle)',borderRadius:'var(--radius-sm)',color:'var(--text-primary)',fontFamily:"'JetBrains Mono',monospace",fontSize:14,outline:'none',cursor:'pointer'}}>
                <option value="price">💰 Price Only</option>
                <option value="percentage">📊 Job Percentage Only</option>
                <option value="both">💰📊 Both</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pricing-card cost-summary">
          <h3>Cost Breakdown <span style={{fontSize:11,color:'var(--text-muted)',fontWeight:400,marginLeft:8}}>({cur.code})</span></h3>
          <div className="cost-rows">
            <div className="cost-row"><span>Monthly rate per engineer</span><span className="cost-val">{fmt(monthlyRate)}</span></div>
            <div className="cost-row"><span>Engineers × Duration</span><span className="cost-val">{p.engineers} × {p.duration} mo</span></div>
            <div className="cost-row"><span>Base cost</span><span className="cost-val">{fmt(baseCost)}</span></div>
            <div className="cost-row"><span>Contingency ({p.contingency}%)</span><span className="cost-val">{fmt(contingencyAmt)}</span></div>
            <div className="cost-row total"><span>Total Estimation</span><span className="cost-val">{fmt(totalCost)}</span></div>
          </div>
        </div>
      </div>

      <div className="section-header" style={{ marginTop: 32 }}>
        <h2>Phase Allocation</h2>
        <p>Define project phases and distribute the budget. Total allocation: <span style={{ color: totalPct === 100 ? 'var(--accent-secondary)' : 'var(--severity-critical)', fontWeight: 700 }}>{totalPct}%</span></p>
      </div>

      <div className="phases-table">
        <table>
          <thead>
            <tr><th>Phase</th><th style={{ width: 100 }}>Allocation %</th><th style={{ width: 100 }}>Months</th>
              {(p.estimationMode||'price') !== 'percentage' && <th style={{ width: 140 }}>Cost ({cur.symbol})</th>}
              {(p.estimationMode||'price') !== 'price' && <th style={{ width: 100 }}>% of Job</th>}
              <th style={{ width: 50 }}></th></tr>
          </thead>
          <tbody>
            {(p.phases || []).map((ph, idx) => {
              const phaseCost = totalCost * ((Number(ph.percentage) || 0) / 100);
              return (
                <tr key={idx}>
                  <td><input type="text" value={ph.name} onChange={e => updPhase(idx, 'name', e.target.value)} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 12px', color: 'var(--text-primary)', fontFamily: "'DM Sans',sans-serif" }} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="number" min="0" max="100" value={ph.percentage} onChange={e => updPhase(idx, 'percentage', Number(e.target.value))}
                        style={{ width: 60, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px', color: 'var(--text-primary)', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, textAlign: 'center' }} />
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>%</span>
                    </div>
                  </td>
                  <td>
                    <input type="number" min="0" step="0.5" value={ph.months} onChange={e => updPhase(idx, 'months', Number(e.target.value))}
                      style={{ width: 60, background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px', color: 'var(--text-primary)', fontFamily: "'JetBrains Mono',monospace", fontSize: 13, textAlign: 'center' }} />
                  </td>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: 'var(--accent-secondary)' }}>
                    {(p.estimationMode||'price') !== 'percentage' && fmt(phaseCost)}
                  </td>
                  {(p.estimationMode||'price') !== 'price' && <td style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: 'var(--text-primary)' }}>{ph.percentage}%</td>}
                  <td>
                    <button className="btn-icon danger" onClick={() => removePhase(idx)} title="Remove">✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button className="btn btn-ghost" onClick={addPhase} style={{ marginTop: 10 }}>+ Add Phase</button>
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', height: 32, borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
          {(p.phases || []).map((ph, i) => (
            <div key={i} title={`${ph.name}: ${ph.percentage}%`}
              style={{ width: `${ph.percentage}%`, background: `hsl(${250 + i * 30}, 60%, ${55 + i * 5}%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: 'white', overflow: 'hidden', whiteSpace: 'nowrap', transition: 'width 0.3s' }}>
              {ph.percentage >= 8 ? `${ph.percentage}%` : ''}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
          {(p.phases || []).map((ph, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: `hsl(${250 + i * 30}, 60%, ${55 + i * 5}%)` }} />
              {ph.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingStep;
