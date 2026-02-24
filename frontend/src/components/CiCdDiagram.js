import React, { useState, useCallback, useRef, useMemo } from 'react';
import { mkId, layoutGraph, exportAsJSON, exportSVGElement, exportSVGAsPNG, remapPipeline } from '../utils/graphEngine';
import { CICD_TEMPLATES, CICD_TEMPLATE_LIST } from '../data/cicdTemplates';

const STAGE_COLORS = {
  gate:'#ff3b5c', source:'#a29bfe', build:'#6c5ce7', test:'#ffd166', scan:'#fd79a8',
  artifact:'#ff8c42', deploy:'#00cec9', approve:'#e17055', monitor:'#55efc4',
  release:'#74b9ff', custom:'#636e72',
};
const STAGE_ICONS = {
  gate:'🚧', source:'📂', build:'🔨', test:'🧪', scan:'🔍', artifact:'📦',
  deploy:'🚀', approve:'✅', monitor:'📡', release:'🏷️', custom:'⚙️',
};
const STAGE_TYPES = Object.keys(STAGE_COLORS);

/* ═══════════ PIPELINE DIAGRAM (reusable) ═══════════ */
function PipelineDiagram({ pipeline, onChange, onDelete, toast }) {
  const [editNodeId, setEditNodeId] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ label:'', type:'build', sub:'', connectFrom:'', connectTo:'' });
  const [connectMode, setConnectMode] = useState(null);
  const svgRef = useRef(null);
  const importRef = useRef(null);

  const nodes = pipeline.nodes || [];
  const edges = pipeline.edges || [];
  const { columns, positions } = useMemo(() => layoutGraph(nodes, edges), [nodes, edges]);
  const nodeR = 32;
  const maxRows = columns.reduce((m, c) => Math.max(m, c.length), 0);
  const svgW = Math.max(columns.length * 150 + 80, 400);
  const svgH = Math.max(maxRows * 110 + 120, 220);

  const updateNode = (id, f, v) => onChange({ ...pipeline, nodes: nodes.map(n => n.id === id ? { ...n, [f]: v } : n) });
  const removeNode = (id) => { onChange({ ...pipeline, nodes: nodes.filter(n => n.id !== id), edges: edges.filter(e => e.from !== id && e.to !== id) }); setEditNodeId(null); };
  const addEdge = (from, to) => { if (from === to || edges.some(e => e.from === from && e.to === to)) return; onChange({ ...pipeline, edges: [...edges, { from, to }] }); };
  const removeEdge = (from, to) => onChange({ ...pipeline, edges: edges.filter(e => !(e.from === from && e.to === to)) });
  const addNode = () => {
    if (!addForm.label.trim()) return;
    const nid = mkId(); const nn = { id: nid, label: addForm.label.trim(), type: addForm.type, sub: addForm.sub.trim() };
    const ne = [...edges]; if (addForm.connectFrom) ne.push({ from: addForm.connectFrom, to: nid }); if (addForm.connectTo) ne.push({ from: nid, to: addForm.connectTo });
    onChange({ ...pipeline, nodes: [...nodes, nn], edges: ne });
    setAddModal(false); setAddForm({ label:'', type:'build', sub:'', connectFrom:'', connectTo:'' });
  };
  const handleNodeClick = (nid) => {
    if (connectMode) { if (connectMode.from && connectMode.from !== nid) { addEdge(connectMode.from, nid); setConnectMode(null); } else { setConnectMode({ from: nid }); } }
    else setEditNodeId(editNodeId === nid ? null : nid);
  };
  const importJSON = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = ev => {
      try { const d = JSON.parse(ev.target.result); if (!d.nodes) throw new Error('Invalid'); const r = remapPipeline(d); onChange({ ...pipeline, name: d.name || pipeline.name, description: d.description || pipeline.description, nodes: r.nodes, edges: r.edges }); toast?.('Imported', 'success'); } catch (err) { toast?.('Import failed: ' + err.message, 'error'); }
    }; reader.readAsText(file); e.target.value = '';
  };

  const renderEdge = (e, idx) => {
    const fp = positions[e.from], tp = positions[e.to]; if (!fp || !tp) return null;
    const x1 = fp.x + nodeR + 4, y1 = fp.y, x2 = tp.x - nodeR - 6, y2 = tp.y, dx = x2 - x1;
    if (Math.abs(y1 - y2) > 10) { const c1 = x1 + dx * 0.4, c2 = x1 + dx * 0.6; return <path key={`e${idx}`} d={`M${x1},${y1} C${c1},${y1} ${c2},${y2} ${x2},${y2}`} fill="none" stroke="var(--text-muted)" strokeWidth="1.5" markerEnd="url(#ah)" opacity=".7" />; }
    return <line key={`e${idx}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--text-muted)" strokeWidth="1.5" markerEnd="url(#ah)" opacity=".7" />;
  };
  const gateIds = new Set(nodes.filter(n => n.type === 'gate').map(n => n.id));
  const gateMaxCol = columns.findIndex(col => col.some(n => !gateIds.has(n.id)));
  const gateZoneW = (gateMaxCol > 0 ? gateMaxCol : 0) * 150;

  return (
    <div className="pipeline-card">
      <div className="pipeline-header">
        <div style={{ flex:1 }}>
          <input className="pipeline-title-input" value={pipeline.name} onChange={e => onChange({ ...pipeline, name: e.target.value })} placeholder="Pipeline name" />
          <input className="pipeline-desc-input" value={pipeline.description || ''} onChange={e => onChange({ ...pipeline, description: e.target.value })} placeholder="Description..." />
          {pipeline.tags?.length > 0 && <div className="pipeline-tags">{pipeline.tags.map(t => <span key={t} className="pipeline-tag">{t}</span>)}</div>}
        </div>
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          <button className="btn btn-ghost btn-xs" onClick={() => setAddModal(true)}>+ Stage</button>
          <button className={`btn btn-ghost btn-xs ${connectMode ? 'btn-active' : ''}`} onClick={() => { setConnectMode(connectMode ? null : { from: null }); toast?.(connectMode ? 'Connect off' : 'Click source → target', 'info'); }}>🔗</button>
          <div className="pipeline-export-group">
            <button className="btn btn-ghost btn-xs" onClick={() => { exportAsJSON({ name:pipeline.name, description:pipeline.description, nodes, edges, tags:pipeline.tags }, pipeline.name || 'pipeline'); toast?.('JSON exported', 'success'); }}>JSON</button>
            <button className="btn btn-ghost btn-xs" onClick={() => { exportSVGElement(svgRef.current, pipeline.name || 'pipeline', svgW, svgH); toast?.('SVG exported', 'success'); }}>SVG</button>
            <button className="btn btn-ghost btn-xs" onClick={() => { exportSVGAsPNG(svgRef.current, pipeline.name || 'pipeline', svgW, svgH); toast?.('PNG exported', 'success'); }}>PNG</button>
            <button className="btn btn-ghost btn-xs" onClick={() => importRef.current?.click()}>📥</button>
            <input ref={importRef} type="file" accept=".json" style={{ display:'none' }} onChange={importJSON} />
          </div>
          <button className="btn btn-ghost btn-xs" style={{ color:'var(--severity-critical)' }} onClick={() => { if (window.confirm('Delete?')) onDelete(); }}>✕</button>
        </div>
      </div>
      {connectMode && <div className="pipeline-connect-banner">{connectMode.from ? 'Click target node' : 'Click source node'}</div>}
      <div className="pipeline-svg-wrap">
        <svg ref={svgRef} width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="pipeline-svg" data-section="cicd" data-diagram-name={pipeline.name || 'pipeline'}>
          <defs><marker id="ah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="var(--text-muted)" /></marker></defs>
          {gateZoneW > 0 && <><rect x={20} y={12} width={gateZoneW} height={svgH-24} rx="12" fill="rgba(255,59,92,0.04)" stroke="rgba(255,59,92,0.18)" strokeDasharray="6 3" /><text x={20+gateZoneW/2} y={28} fontSize="9" fill="#ff3b5c" fontFamily="'JetBrains Mono',monospace" textAnchor="middle" letterSpacing="1.5">GATES</text></>}
          {edges.map((e, i) => renderEdge(e, i))}
          {nodes.map(n => { const p = positions[n.id]; if (!p) return null; const c = STAGE_COLORS[n.type] || STAGE_COLORS.custom; const sel = editNodeId === n.id || connectMode?.from === n.id;
            return (<g key={n.id} style={{ cursor: connectMode ? 'crosshair' : 'pointer' }} onClick={() => handleNodeClick(n.id)}>
              {n.type === 'gate' ? <polygon points={`${p.x},${p.y-26} ${p.x+26},${p.y} ${p.x},${p.y+26} ${p.x-26},${p.y}`} fill={sel?c+'44':c+'14'} stroke={c} strokeWidth={sel?3:2} /> : <circle cx={p.x} cy={p.y} r={nodeR} fill={sel?c+'44':c+'14'} stroke={c} strokeWidth={sel?3:2} />}
              <text x={p.x} y={p.y+1} textAnchor="middle" fontSize="18" dominantBaseline="central">{STAGE_ICONS[n.type]||'⚙️'}</text>
              <text x={p.x} y={p.y+(n.type==='gate'?40:nodeR+16)} textAnchor="middle" fontSize="10" fill="var(--text-primary)" fontFamily="'DM Sans',sans-serif" fontWeight="600">{n.label.length>16?n.label.slice(0,15)+'…':n.label}</text>
              <text x={p.x} y={p.y+(n.type==='gate'?52:nodeR+28)} textAnchor="middle" fontSize="8" fill="var(--text-muted)" fontFamily="'JetBrains Mono',monospace">{(n.sub||'').length>22?(n.sub||'').slice(0,21)+'…':(n.sub||'')}</text>
            </g>); })}
        </svg>
      </div>
      <div className="pipeline-stage-list">
        <div className="pipeline-stage-list-header"><span>Stages ({nodes.length}) · Edges ({edges.length})</span></div>
        {nodes.map(n => {
          const oc = edges.filter(e => e.from === n.id).length, ic = edges.filter(e => e.to === n.id).length;
          return (<div key={n.id} className={`pipeline-stage-row ${editNodeId===n.id?'active':''}`} onClick={() => setEditNodeId(editNodeId===n.id?null:n.id)}>
            <span className="pipeline-stage-dot" style={{ background:STAGE_COLORS[n.type]||'#636e72' }} /><span className="pipeline-stage-label">{n.label}</span>
            {ic>0&&<span className="pipeline-conn-badge in">←{ic}</span>}{oc>0&&<span className="pipeline-conn-badge out">→{oc}</span>}
            <span className="pipeline-stage-type">{n.type}</span>
          </div>);
        })}
      </div>
      {editNodeId && (() => { const n = nodes.find(x => x.id === editNodeId); if (!n) return null; const outs = edges.filter(e => e.from===n.id); const ins = edges.filter(e => e.to===n.id);
        return (<div className="pipeline-editor">
          <div className="config-grid" style={{gap:10}}><div className="config-field"><label>Label</label><input type="text" value={n.label} onChange={e=>updateNode(n.id,'label',e.target.value)} /></div><div className="config-field"><label>Type</label><select value={n.type} onChange={e=>updateNode(n.id,'type',e.target.value)}>{STAGE_TYPES.map(t=><option key={t} value={t}>{STAGE_ICONS[t]} {t}</option>)}</select></div></div>
          <div className="config-field" style={{marginTop:8}}><label>Description</label><input type="text" value={n.sub||''} onChange={e=>updateNode(n.id,'sub',e.target.value)} /></div>
          <div style={{marginTop:8,display:'flex',gap:6,flexWrap:'wrap'}}>
            <label style={{fontSize:10,color:'var(--text-muted)',width:'100%',fontFamily:"'JetBrains Mono',monospace"}}>CONNECTIONS</label>
            {ins.map(e=>{const s=nodes.find(x=>x.id===e.from);return<div key={e.from+e.to} className="conn-chip"><span>←{s?.label||'?'}</span><button className="conn-remove" onClick={()=>removeEdge(e.from,e.to)}>✕</button></div>;})}
            {outs.map(e=>{const t=nodes.find(x=>x.id===e.to);return<div key={e.from+e.to} className="conn-chip"><span>→{t?.label||'?'}</span><button className="conn-remove" onClick={()=>removeEdge(e.from,e.to)}>✕</button></div>;})}
            <select className="conn-add-select" defaultValue="" onChange={e=>{if(e.target.value){addEdge(n.id,e.target.value);e.target.value='';}}}><option value="" disabled>+ connect →</option>{nodes.filter(x=>x.id!==n.id&&!outs.some(o=>o.to===x.id)).map(x=><option key={x.id} value={x.id}>{STAGE_ICONS[x.type]} {x.label}</option>)}</select>
          </div>
          <div style={{display:'flex',gap:8,marginTop:10}}><button className="btn btn-ghost btn-xs" onClick={()=>setEditNodeId(null)}>Done</button><button className="btn btn-ghost btn-xs" style={{color:'var(--severity-critical)'}} onClick={()=>removeNode(n.id)}>Remove</button></div>
        </div>);
      })()}
      {addModal && (<div className="modal-overlay" onClick={()=>setAddModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><h3>Add Stage</h3><button className="btn-icon" onClick={()=>setAddModal(false)}>✕</button></div>
        <div className="modal-body">
          <div className="config-field"><label>Label *</label><input type="text" placeholder="Stage name" value={addForm.label} onChange={e=>setAddForm(p=>({...p,label:e.target.value}))} /></div>
          <div className="config-field"><label>Type</label><div className="stage-type-grid">{STAGE_TYPES.map(t=><button key={t} type="button" className={`stage-type-chip ${addForm.type===t?'selected':''}`} style={{'--chip-color':STAGE_COLORS[t]}} onClick={()=>setAddForm(p=>({...p,type:t}))}><span>{STAGE_ICONS[t]}</span><span>{t}</span></button>)}</div></div>
          <div className="config-field"><label>Description</label><input type="text" placeholder="Tool / details" value={addForm.sub} onChange={e=>setAddForm(p=>({...p,sub:e.target.value}))} /></div>
          <div className="config-grid" style={{gap:8,marginTop:8}}>
            <div className="config-field"><label>From</label><select value={addForm.connectFrom} onChange={e=>setAddForm(p=>({...p,connectFrom:e.target.value}))}><option value="">None</option>{nodes.map(n=><option key={n.id} value={n.id}>{STAGE_ICONS[n.type]} {n.label}</option>)}</select></div>
            <div className="config-field"><label>To</label><select value={addForm.connectTo} onChange={e=>setAddForm(p=>({...p,connectTo:e.target.value}))}><option value="">None</option>{nodes.map(n=><option key={n.id} value={n.id}>{STAGE_ICONS[n.type]} {n.label}</option>)}</select></div>
          </div>
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setAddModal(false)}>Cancel</button><button className="btn btn-primary" onClick={addNode} disabled={!addForm.label.trim()}>Add</button></div>
      </div></div>)}
    </div>
  );
}

/* ═══════════ WORKFLOW ═══════════ */
function WorkflowContainer({ workflow, onChange, onDelete, toast }) {
  const pipelines = workflow.pipelines || [];
  const [showPicker, setShowPicker] = useState(false);
  const [filterTag, setFilterTag] = useState('all');
  const wfImportRef = useRef(null);
  const upd = (i, p) => { const n = [...pipelines]; n[i] = p; onChange({ ...workflow, pipelines: n }); };
  const del = (i) => { onChange({ ...workflow, pipelines: pipelines.filter((_,j)=>j!==i) }); toast?.('Deleted','success'); };
  const addTpl = (key) => {
    const fn = CICD_TEMPLATES[key]; if (!fn) return;
    const t = fn(); const p = { id:mkId(), ...t };
    onChange({ ...workflow, pipelines: [...pipelines, p] });
    setShowPicker(false); toast?.(`"${t.name}" added`,'success');
  };
  const addBlank = () => {
    const ids = {}; const mk = (k) => { ids[k] = mkId(); return ids[k]; };
    onChange({ ...workflow, pipelines: [...pipelines, { id:mkId(), name:'New Pipeline', description:'', tags:[], nodes:[
      {id:mk('g1'),label:'Gate',type:'gate',sub:''},{id:mk('s1'),label:'Source',type:'source',sub:''},{id:mk('b1'),label:'Build',type:'build',sub:''},{id:mk('d1'),label:'Deploy',type:'deploy',sub:''}
    ], edges:[{from:ids.g1,to:ids.s1},{from:ids.s1,to:ids.b1},{from:ids.b1,to:ids.d1}] }] });
    setShowPicker(false); toast?.('Blank added','success');
  };
  const importWf = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = ev => {
      try { const d = JSON.parse(ev.target.result);
        if (d.pipelines) { const imp = d.pipelines.map(p => remapPipeline(p)); onChange({ ...workflow, pipelines: [...pipelines, ...imp] }); toast?.(`${imp.length} pipelines imported`,'success'); }
        else if (d.nodes) { const r = remapPipeline(d); onChange({ ...workflow, pipelines: [...pipelines, { ...r, name:d.name||'Imported' }] }); toast?.('Pipeline imported','success'); }
      } catch (err) { toast?.('Import failed: '+err.message,'error'); }
    }; reader.readAsText(file); e.target.value = '';
  };

  const allTags = ['all','ci','cd','cloud-native','on-premise','air-gapped','gitops','monolith','microservice'];
  const filtered = filterTag === 'all' ? CICD_TEMPLATE_LIST : CICD_TEMPLATE_LIST.filter(t => { const tpl = CICD_TEMPLATES[t.key](); return tpl.tags?.includes(filterTag); });

  return (
    <div className="workflow-card">
      <div className="workflow-header">
        <div style={{flex:1}}>
          <input className="pipeline-title-input" style={{fontSize:22}} value={workflow.name} onChange={e=>onChange({...workflow,name:e.target.value})} placeholder="Workflow name" />
          <input className="pipeline-desc-input" value={workflow.description||''} onChange={e=>onChange({...workflow,description:e.target.value})} placeholder="Description..." />
        </div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
          <span className="workflow-badge">{pipelines.length} pipeline{pipelines.length!==1?'s':''}</span>
          <button className="btn btn-ghost btn-xs" onClick={()=>setShowPicker(true)}>+ Pipeline</button>
          <button className="btn btn-ghost btn-xs" onClick={()=>{exportAsJSON({name:workflow.name,description:workflow.description,pipelines},workflow.name||'workflow');toast?.('Exported','success');}}>📄 Export</button>
          <button className="btn btn-ghost btn-xs" onClick={()=>wfImportRef.current?.click()}>📥 Import</button>
          <input ref={wfImportRef} type="file" accept=".json" style={{display:'none'}} onChange={importWf} />
          <button className="btn btn-ghost btn-xs" style={{color:'var(--severity-critical)'}} onClick={()=>{if(window.confirm('Delete workflow?'))onDelete();}}>Delete</button>
        </div>
      </div>
      <div className="workflow-pipelines">
        {pipelines.map((p,i) => <PipelineDiagram key={p.id} pipeline={p} onChange={up=>upd(i,up)} onDelete={()=>del(i)} toast={toast} />)}
        {pipelines.length===0 && <div className="empty-state" style={{padding:'30px 20px'}}><p>No pipelines. Add one to start.</p><button className="btn btn-primary" style={{marginTop:12}} onClick={()=>setShowPicker(true)}>+ Pipeline</button></div>}
      </div>
      {showPicker && (<div className="modal-overlay" onClick={()=>setShowPicker(false)}><div className="modal modal-lg" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><h3>Add Pipeline</h3><button className="btn-icon" onClick={()=>setShowPicker(false)}>✕</button></div>
        <div className="modal-body">
          <div className="filter-bar" style={{marginBottom:12}}>{allTags.map(t=><button key={t} className={`filter-chip ${filterTag===t?'active':''}`} onClick={()=>setFilterTag(t)}>{t==='all'?'All':t}</button>)}</div>
          <div className="template-picker-grid">
            {filtered.map(({key,icon,cat}) => { const t = CICD_TEMPLATES[key](); return (
              <button key={key} className="template-picker-card" onClick={()=>addTpl(key)}>
                <div className="tpl-pick-icon">{icon}</div>
                <div className="tpl-pick-info"><h4>{t.name}</h4><p>{t.description}</p><div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:4}}><span className="tpl-pick-count">{t.nodes.length} stages</span><span className="pipeline-tag">{cat}</span>{t.tags?.map(tg=><span key={tg} className="pipeline-tag">{tg}</span>)}</div></div>
              </button>);
            })}
            <button className="template-picker-card blank" onClick={addBlank}><div className="tpl-pick-icon">➕</div><div className="tpl-pick-info"><h4>Blank Pipeline</h4><p>Minimal gate → source → build → deploy</p></div></button>
          </div>
        </div>
      </div></div>)}
    </div>
  );
}

/* ═══════════ MAIN ═══════════ */
const CiCdDiagram = ({ diagrams, setDiagrams, toast }) => {
  const data = diagrams || { workflows: [] };
  const workflows = data.workflows || [];
  const [showNewWf, setShowNewWf] = useState(false);
  const [newWfName, setNewWfName] = useState('');
  const persist = useCallback(wfs => setDiagrams({ ...data, workflows: wfs }), [data, setDiagrams]);

  return (
    <div className="animate-in">
      <div className="section-header"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h2>CI/CD Pipeline Diagrams</h2><p>Design workflows with multiple pipelines, parallel stages, and connections. Supports CI, CD, cloud-native, on-premise, and air-gapped environments.</p></div>
        <button className="btn btn-primary" onClick={()=>setShowNewWf(true)}>+ Workflow</button>
      </div></div>
      <div className="pipeline-legend">{Object.entries(STAGE_COLORS).map(([k,v])=><div key={k} className="pipeline-legend-item"><span className="pipeline-legend-dot" style={{background:v}} /><span>{STAGE_ICONS[k]}</span><span>{k}</span></div>)}</div>
      {workflows.length===0 && <div className="empty-state" style={{marginTop:40}}><div style={{fontSize:48,marginBottom:16}}>🔄</div><h3>No Workflows</h3><p>Create a workflow to organize CI/CD pipelines.</p><button className="btn btn-primary" style={{marginTop:16}} onClick={()=>setShowNewWf(true)}>+ Workflow</button></div>}
      {workflows.map((wf,i) => <WorkflowContainer key={wf.id} workflow={wf} onChange={up=>{const n=[...workflows];n[i]=up;persist(n);}} onDelete={()=>{persist(workflows.filter((_,j)=>j!==i));toast?.('Deleted','success');}} toast={toast} />)}
      {showNewWf && (<div className="modal-overlay" onClick={()=>setShowNewWf(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><h3>New Workflow</h3><button className="btn-icon" onClick={()=>setShowNewWf(false)}>✕</button></div>
        <div className="modal-body"><div className="config-field"><label>Name</label><input type="text" placeholder="e.g. Production Release" value={newWfName} onChange={e=>setNewWfName(e.target.value)} autoFocus onKeyDown={e=>{if(e.key==='Enter'){const nm=newWfName.trim()||'New Workflow';persist([...workflows,{id:mkId(),name:nm,description:'',pipelines:[]}]);setShowNewWf(false);setNewWfName('');toast?.(`"${nm}" created`,'success');}}} /></div></div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowNewWf(false)}>Cancel</button><button className="btn btn-primary" onClick={()=>{const nm=newWfName.trim()||'New Workflow';persist([...workflows,{id:mkId(),name:nm,description:'',pipelines:[]}]);setShowNewWf(false);setNewWfName('');toast?.(`"${nm}" created`,'success');}}>Create</button></div>
      </div></div>)}
    </div>
  );
};
export default CiCdDiagram;
