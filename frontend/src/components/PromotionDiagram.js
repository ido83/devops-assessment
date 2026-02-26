import React, { useState, useCallback, useRef, useMemo } from 'react';
import { mkId, layoutGraph, exportAsJSON, exportSVGElement, exportSVGAsPNG, remapPipeline } from '../utils/graphEngine';
import { PROMO_TEMPLATES, PROMO_TEMPLATE_LIST, PROMO_NODE_COLORS, PROMO_NODE_ICONS } from '../data/promotionTemplates';
const NODE_TYPES = Object.keys(PROMO_NODE_COLORS);

function WorkflowDiagram({ flow, onChange, onDelete, toast }) {
  const [editId, setEditId] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ label:'',type:'promote',sub:'',connectFrom:'',connectTo:'' });
  const [connectMode, setConnectMode] = useState(null);
  const svgRef = useRef(null); const importRef = useRef(null);
  const nodes = flow.nodes||[]; const edges = flow.edges||[];
  const { columns, positions } = useMemo(()=>layoutGraph(nodes,edges),[nodes,edges]);
  const nodeR=32;const maxR=columns.reduce((m,c)=>Math.max(m,c.length),0);
  const svgW=Math.max(columns.length*150+80,400);const svgH=Math.max(maxR*110+120,220);
  const upN=(id,f,v)=>onChange({...flow,nodes:nodes.map(n=>n.id===id?{...n,[f]:v}:n)});
  const rmN=(id)=>{onChange({...flow,nodes:nodes.filter(n=>n.id!==id),edges:edges.filter(e=>e.from!==id&&e.to!==id)});setEditId(null);};
  const addE=(a,b)=>{if(a===b||edges.some(e=>e.from===a&&e.to===b))return;onChange({...flow,edges:[...edges,{from:a,to:b}]});};
  const rmE=(a,b)=>onChange({...flow,edges:edges.filter(e=>!(e.from===a&&e.to===b))});
  const addN=()=>{if(!addForm.label.trim())return;const nid=mkId();const ne=[...edges];if(addForm.connectFrom)ne.push({from:addForm.connectFrom,to:nid});if(addForm.connectTo)ne.push({from:nid,to:addForm.connectTo});onChange({...flow,nodes:[...nodes,{id:nid,label:addForm.label.trim(),type:addForm.type,sub:addForm.sub.trim()}],edges:ne});setAddModal(false);setAddForm({label:'',type:'promote',sub:'',connectFrom:'',connectTo:''});};
  const handleClick=(nid)=>{if(connectMode){if(connectMode.from&&connectMode.from!==nid){addE(connectMode.from,nid);setConnectMode(null);}else setConnectMode({from:nid});}else setEditId(editId===nid?null:nid);};
  const importJSON=(e)=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const d=JSON.parse(ev.target.result);const rm=remapPipeline(d);onChange({...flow,name:d.name||flow.name,nodes:rm.nodes,edges:rm.edges});toast?.('Imported','success');}catch(err){toast?.('Import failed','error');}};r.readAsText(f);e.target.value='';};
  const renderEdge=(e,i)=>{const fp=positions[e.from],tp=positions[e.to];if(!fp||!tp)return null;const x1=fp.x+nodeR+4,y1=fp.y,x2=tp.x-nodeR-6,y2=tp.y,dx=x2-x1;if(Math.abs(y1-y2)>10){const c1=x1+dx*.4,c2=x1+dx*.6;return<path key={`e${i}`} d={`M${x1},${y1} C${c1},${y1} ${c2},${y2} ${x2},${y2}`} fill="none" stroke="var(--text-muted)" strokeWidth="1.5" markerEnd="url(#pwah)" opacity=".7"/>;}return<line key={`e${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--text-muted)" strokeWidth="1.5" markerEnd="url(#pwah)" opacity=".7"/>;};
  const gateIds=new Set(nodes.filter(n=>n.type==='gate').map(n=>n.id));const gateMaxCol=columns.findIndex(col=>col.some(n=>!gateIds.has(n.id)));const gateZoneW=(gateMaxCol>0?gateMaxCol:0)*150;

  return (
    <div className="pipeline-card">
      <div className="pipeline-header">
        <div style={{flex:1}}>
          <input className="pipeline-title-input" value={flow.name} onChange={e=>onChange({...flow,name:e.target.value})} placeholder="Workflow name"/>
          <input className="pipeline-desc-input" value={flow.description||''} onChange={e=>onChange({...flow,description:e.target.value})} placeholder="Description..."/>
          {flow.cat&&<span className="pipeline-tag" style={{marginTop:4}}>{flow.cat}</span>}
        </div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
          <button className="btn btn-ghost btn-xs" onClick={()=>setAddModal(true)}>+ Stage</button>
          <button className={`btn btn-ghost btn-xs ${connectMode?'btn-active':''}`} onClick={()=>{setConnectMode(connectMode?null:{from:null});toast?.(connectMode?'Off':'Click source → target','info');}}>🔗</button>
          <div className="pipeline-export-group">
            <button className="btn btn-ghost btn-xs" onClick={()=>{exportAsJSON({name:flow.name,description:flow.description,cat:flow.cat,nodes,edges},flow.name||'promotion');toast?.('JSON exported','success');}}>JSON</button>
            <button className="btn btn-ghost btn-xs" onClick={()=>{exportSVGElement(svgRef.current,flow.name||'promotion',svgW,svgH);toast?.('SVG exported','success');}}>SVG</button>
            <button className="btn btn-ghost btn-xs" onClick={()=>{exportSVGAsPNG(svgRef.current,flow.name||'promotion',svgW,svgH);toast?.('PNG exported','success');}}>PNG</button>
            <button className="btn btn-ghost btn-xs" onClick={()=>importRef.current?.click()}>📥</button>
            <input ref={importRef} type="file" accept=".json" style={{display:'none'}} onChange={importJSON}/>
          </div>
          <button className="btn btn-ghost btn-xs" style={{color:'var(--severity-critical)'}} onClick={()=>{if(window.confirm('Delete?'))onDelete();}}>✕</button>
        </div>
      </div>
      {connectMode&&<div className="pipeline-connect-banner">{connectMode.from?'Click target':'Click source'}</div>}
      <div className="pipeline-svg-wrap">
        <svg ref={svgRef} width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="pipeline-svg" data-section="promotion" data-diagram-name={flow.name || 'promotion'}>
          <defs><marker id="pwah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="var(--text-muted)"/></marker></defs>
          {gateZoneW>0&&<><rect x={20} y={12} width={gateZoneW} height={svgH-24} rx="12" fill="rgba(255,59,92,0.04)" stroke="rgba(255,59,92,0.18)" strokeDasharray="6 3"/><text x={20+gateZoneW/2} y={28} fontSize="9" fill="#ff3b5c" fontFamily="'JetBrains Mono',monospace" textAnchor="middle" letterSpacing="1.5">GATES</text></>}
          {edges.map((e,i)=>renderEdge(e,i))}
          {nodes.map(n=>{const p=positions[n.id];if(!p)return null;const c=PROMO_NODE_COLORS[n.type]||'#636e72';const sel=editId===n.id||connectMode?.from===n.id;return(<g key={n.id} style={{cursor:connectMode?'crosshair':'pointer'}} onClick={()=>handleClick(n.id)}>
            {n.type==='gate'?<polygon points={`${p.x},${p.y-26} ${p.x+26},${p.y} ${p.x},${p.y+26} ${p.x-26},${p.y}`} fill={sel?c+'44':c+'14'} stroke={c} strokeWidth={sel?3:2}/>:<circle cx={p.x} cy={p.y} r={nodeR} fill={sel?c+'44':c+'14'} stroke={c} strokeWidth={sel?3:2}/>}
            <text x={p.x} y={p.y+1} textAnchor="middle" fontSize="18" dominantBaseline="central">{PROMO_NODE_ICONS[n.type]||'⚙️'}</text>
            <text x={p.x} y={p.y+(n.type==='gate'?40:nodeR+16)} textAnchor="middle" fontSize="10" fill="var(--text-primary)" fontFamily="'DM Sans',sans-serif" fontWeight="600">{n.label.length>16?n.label.slice(0,15)+'…':n.label}</text>
            <text x={p.x} y={p.y+(n.type==='gate'?52:nodeR+28)} textAnchor="middle" fontSize="8" fill="var(--text-muted)" fontFamily="'JetBrains Mono',monospace">{(n.sub||'').length>22?(n.sub||'').slice(0,21)+'…':(n.sub||'')}</text>
          </g>);})}
        </svg>
      </div>
      <div className="pipeline-stage-list">
        <div className="pipeline-stage-list-header"><span>Stages ({nodes.length}) · Edges ({edges.length})</span></div>
        {nodes.map(n=>{const oc=edges.filter(e=>e.from===n.id).length,ic=edges.filter(e=>e.to===n.id).length;return<div key={n.id} className={`pipeline-stage-row ${editId===n.id?'active':''}`} onClick={()=>setEditId(editId===n.id?null:n.id)}><span className="pipeline-stage-dot" style={{background:PROMO_NODE_COLORS[n.type]||'#636e72'}}/><span className="pipeline-stage-label">{n.label}</span>{ic>0&&<span className="pipeline-conn-badge in">←{ic}</span>}{oc>0&&<span className="pipeline-conn-badge out">→{oc}</span>}<span className="pipeline-stage-type">{n.type}</span></div>;})}
      </div>
      {editId&&(()=>{const n=nodes.find(x=>x.id===editId);if(!n)return null;const outs=edges.filter(e=>e.from===n.id);const ins=edges.filter(e=>e.to===n.id);return<div className="pipeline-editor"><div className="config-grid" style={{gap:10}}><div className="config-field"><label>Label</label><input type="text" value={n.label} onChange={e=>upN(n.id,'label',e.target.value)}/></div><div className="config-field"><label>Type</label><select value={n.type} onChange={e=>upN(n.id,'type',e.target.value)}>{NODE_TYPES.map(t=><option key={t} value={t}>{PROMO_NODE_ICONS[t]} {t}</option>)}</select></div></div><div className="config-field" style={{marginTop:8}}><label>Description</label><input type="text" value={n.sub||''} onChange={e=>upN(n.id,'sub',e.target.value)}/></div><div style={{marginTop:8,display:'flex',gap:6,flexWrap:'wrap'}}><label style={{fontSize:10,color:'var(--text-muted)',width:'100%',fontFamily:"'JetBrains Mono',monospace"}}>CONNECTIONS</label>{ins.map(e=><div key={e.from+e.to} className="conn-chip"><span>←{nodes.find(x=>x.id===e.from)?.label||'?'}</span><button className="conn-remove" onClick={()=>rmE(e.from,e.to)}>✕</button></div>)}{outs.map(e=><div key={e.from+e.to} className="conn-chip"><span>→{nodes.find(x=>x.id===e.to)?.label||'?'}</span><button className="conn-remove" onClick={()=>rmE(e.from,e.to)}>✕</button></div>)}<select className="conn-add-select" defaultValue="" onChange={e=>{if(e.target.value){addE(n.id,e.target.value);e.target.value='';}}}><option value="" disabled>+ connect →</option>{nodes.filter(x=>x.id!==n.id&&!outs.some(o=>o.to===x.id)).map(x=><option key={x.id} value={x.id}>{PROMO_NODE_ICONS[x.type]} {x.label}</option>)}</select></div><div style={{display:'flex',gap:8,marginTop:10}}><button className="btn btn-ghost btn-xs" onClick={()=>setEditId(null)}>Done</button><button className="btn btn-ghost btn-xs" style={{color:'var(--severity-critical)'}} onClick={()=>rmN(n.id)}>Remove</button></div></div>;})()}
      {addModal&&<div className="modal-overlay" onClick={()=>setAddModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-header"><h3>Add Stage</h3><button className="btn-icon" onClick={()=>setAddModal(false)}>✕</button></div><div className="modal-body"><div className="config-field"><label>Label *</label><input type="text" value={addForm.label} onChange={e=>setAddForm(p=>({...p,label:e.target.value}))}/></div><div className="config-field"><label>Type</label><div className="stage-type-grid">{NODE_TYPES.map(t=><button key={t} type="button" className={`stage-type-chip ${addForm.type===t?'selected':''}`} style={{'--chip-color':PROMO_NODE_COLORS[t]}} onClick={()=>setAddForm(p=>({...p,type:t}))}><span>{PROMO_NODE_ICONS[t]}</span><span>{t}</span></button>)}</div></div><div className="config-field"><label>Description</label><input type="text" value={addForm.sub} onChange={e=>setAddForm(p=>({...p,sub:e.target.value}))}/></div><div className="config-grid" style={{gap:8,marginTop:8}}><div className="config-field"><label>From</label><select value={addForm.connectFrom} onChange={e=>setAddForm(p=>({...p,connectFrom:e.target.value}))}><option value="">None</option>{nodes.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></div><div className="config-field"><label>To</label><select value={addForm.connectTo} onChange={e=>setAddForm(p=>({...p,connectTo:e.target.value}))}><option value="">None</option>{nodes.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></div></div></div><div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setAddModal(false)}>Cancel</button><button className="btn btn-primary" onClick={addN} disabled={!addForm.label.trim()}>Add</button></div></div></div>}
    </div>
  );
}

const PromotionDiagram = ({ data, setData, toast }) => {
  const d = data||{workflows:[]};const workflows=d.workflows||[];
  const [showPicker, setShowPicker] = useState(false);const [filterCat, setFilterCat] = useState('all');
  const persist = useCallback(w=>setData({...d,workflows:w}),[d,setData]);
  const addTpl=(key)=>{const fn=PROMO_TEMPLATES[key];if(!fn)return;const t=fn();persist([...workflows,{id:mkId(),...t}]);setShowPicker(false);toast?.(`"${t.name}" added`,'success');};
  const addBlank=()=>{const ids={};const mk=(k)=>{ids[k]=mkId();return ids[k];};persist([...workflows,{id:mkId(),name:'Custom Workflow',description:'',cat:'Custom',nodes:[{id:mk('s1'),label:'Source',type:'source',sub:''},{id:mk('p1'),label:'Promote',type:'promote',sub:''},{id:mk('n1'),label:'Notify',type:'notify',sub:''}],edges:[{from:ids.s1,to:ids.p1},{from:ids.p1,to:ids.n1}]}]);setShowPicker(false);};
  const cats=['all','Standard','Advanced'];
  const filtered=filterCat==='all'?PROMO_TEMPLATE_LIST:PROMO_TEMPLATE_LIST.filter(t=>t.cat===filterCat);
  return (
    <div className="animate-in">
      <div className="section-header"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><h2>Promotion Workflows</h2><p>Model artifact and environment promotion pipelines — from standard multi-env flows to GitOps and feature-flag-based releases.</p></div><button className="btn btn-primary" onClick={()=>setShowPicker(true)}>+ Workflow</button></div></div>
      <div className="pipeline-legend">{Object.entries(PROMO_NODE_COLORS).map(([k,v])=><div key={k} className="pipeline-legend-item"><span className="pipeline-legend-dot" style={{background:v}}/><span>{PROMO_NODE_ICONS[k]}</span><span>{k}</span></div>)}</div>
      {workflows.length===0&&<div className="empty-state" style={{marginTop:40}}><div style={{fontSize:48,marginBottom:16}}>🎯</div><h3>No Promotion Workflows</h3><p>Add a workflow to visualize your artifact and environment promotion process.</p><button className="btn btn-primary" style={{marginTop:16}} onClick={()=>setShowPicker(true)}>+ Workflow</button></div>}
      {workflows.map((w,i)=><WorkflowDiagram key={w.id} flow={w} onChange={up=>{const n=[...workflows];n[i]=up;persist(n);}} onDelete={()=>{persist(workflows.filter((_,j)=>j!==i));toast?.('Deleted','success');}} toast={toast}/>)}
      {showPicker&&<div className="modal-overlay" onClick={()=>setShowPicker(false)}><div className="modal modal-lg" onClick={e=>e.stopPropagation()}><div className="modal-header"><h3>Add Promotion Workflow</h3><button className="btn-icon" onClick={()=>setShowPicker(false)}>✕</button></div><div className="modal-body"><div className="filter-bar" style={{marginBottom:12}}>{cats.map(c=><button key={c} className={`filter-chip ${filterCat===c?'active':''}`} onClick={()=>setFilterCat(c)}>{c}</button>)}</div><div className="template-picker-grid">{filtered.map(({key,icon,cat})=>{const t=PROMO_TEMPLATES[key]();return<button key={key} className="template-picker-card" onClick={()=>addTpl(key)}><div className="tpl-pick-icon">{icon}</div><div className="tpl-pick-info"><h4>{t.name}</h4><p>{t.description}</p><div style={{display:'flex',gap:4,marginTop:4}}><span className="tpl-pick-count">{t.nodes.length} stages</span><span className="pipeline-tag">{cat}</span></div></div></button>;})}<button className="template-picker-card blank" onClick={addBlank}><div className="tpl-pick-icon">➕</div><div className="tpl-pick-info"><h4>Custom Workflow</h4><p>Blank source → promote → notify</p></div></button></div></div></div></div>}
    </div>);};
export default PromotionDiagram;
