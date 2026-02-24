import React, { useState, useCallback, useRef } from 'react';
import { mkId, exportAsJSON } from '../utils/graphEngine';

const REGISTRY_TYPES = [
  { id:'jfrog', name:'JFrog Artifactory', icon:'🐸', color:'#40c463' },
  { id:'harbor', name:'Harbor', icon:'⚓', color:'#4a90d9' },
  { id:'nexus', name:'Sonatype Nexus', icon:'📦', color:'#1b998b' },
];
const REPO_CLASSES = [
  { id:'local', label:'Local', desc:'Internal hosted packages', icon:'💾', color:'#6c5ce7' },
  { id:'remote', label:'Remote', desc:'Proxy to external registry', icon:'🌐', color:'#00cec9' },
  { id:'virtual', label:'Virtual', desc:'Aggregates local + remote', icon:'🔗', color:'#fd79a8' },
];
const PKG_TYPES = [
  { id:'generic', label:'Generic', icon:'📁' },
  { id:'docker', label:'Docker', icon:'🐳' },
  { id:'npm', label:'npm', icon:'📗' },
  { id:'pypi', label:'PyPI', icon:'🐍' },
  { id:'maven', label:'Maven', icon:'☕' },
  { id:'nuget', label:'NuGet', icon:'💎' },
  { id:'helm', label:'Helm', icon:'☸️' },
  { id:'rpm', label:'RPM', icon:'🐧' },
  { id:'debian', label:'Debian', icon:'🔵' },
  { id:'go', label:'Go', icon:'🔷' },
  { id:'conan', label:'Conan (C++)', icon:'⚡' },
  { id:'conda', label:'Conda', icon:'🐍' },
  { id:'oci', label:'OCI', icon:'📦' },
  { id:'custom', label:'Custom', icon:'⚙️' },
];

const DEFAULT_REGISTRIES = {
  jfrog_standard: () => ({
    name:'JFrog Artifactory — Standard Layout', registryType:'jfrog', description:'Enterprise Artifactory with local, remote, and virtual repos',
    repos: [
      { id:mkId(), name:'libs-release-local', repoClass:'local', pkgType:'maven', path:'/libs-release-local', children:[{id:mkId(),name:'com',children:[{id:mkId(),name:'mycompany',children:[{id:mkId(),name:'app/1.0.0/app-1.0.0.jar'}]}]}] },
      { id:mkId(), name:'libs-snapshot-local', repoClass:'local', pkgType:'maven', path:'/libs-snapshot-local', children:[] },
      { id:mkId(), name:'docker-local', repoClass:'local', pkgType:'docker', path:'/docker-local', children:[{id:mkId(),name:'myapp',children:[{id:mkId(),name:'latest'},{id:mkId(),name:'v1.2.3'}]}] },
      { id:mkId(), name:'npm-local', repoClass:'local', pkgType:'npm', path:'/npm-local', children:[{id:mkId(),name:'@myorg',children:[{id:mkId(),name:'ui-components'},{id:mkId(),name:'api-client'}]}] },
      { id:mkId(), name:'pypi-local', repoClass:'local', pkgType:'pypi', path:'/pypi-local', children:[] },
      { id:mkId(), name:'generic-local', repoClass:'local', pkgType:'generic', path:'/generic-local', children:[{id:mkId(),name:'releases',children:[{id:mkId(),name:'v1.0',children:[{id:mkId(),name:'app.tar.gz'}]}]}] },
      { id:mkId(), name:'docker-remote', repoClass:'remote', pkgType:'docker', path:'/docker-remote', url:'https://registry-1.docker.io', children:[] },
      { id:mkId(), name:'npm-remote', repoClass:'remote', pkgType:'npm', path:'/npm-remote', url:'https://registry.npmjs.org', children:[] },
      { id:mkId(), name:'pypi-remote', repoClass:'remote', pkgType:'pypi', path:'/pypi-remote', url:'https://pypi.org', children:[] },
      { id:mkId(), name:'maven-remote', repoClass:'remote', pkgType:'maven', path:'/maven-remote', url:'https://repo1.maven.org/maven2', children:[] },
      { id:mkId(), name:'docker-virtual', repoClass:'virtual', pkgType:'docker', path:'/docker', includes:['docker-local','docker-remote'], children:[] },
      { id:mkId(), name:'npm-virtual', repoClass:'virtual', pkgType:'npm', path:'/npm', includes:['npm-local','npm-remote'], children:[] },
    ],
  }),
  harbor_standard: () => ({
    name:'Harbor — Container Registry', registryType:'harbor', description:'Cloud-native container registry with projects',
    repos: [
      { id:mkId(), name:'library', repoClass:'local', pkgType:'docker', path:'/library', children:[{id:mkId(),name:'nginx'},{id:mkId(),name:'redis'},{id:mkId(),name:'postgres'}] },
      { id:mkId(), name:'myproject', repoClass:'local', pkgType:'docker', path:'/myproject', children:[{id:mkId(),name:'frontend',children:[{id:mkId(),name:'v1.0.0'},{id:mkId(),name:'latest'}]},{id:mkId(),name:'backend',children:[{id:mkId(),name:'v2.1.0'}]}] },
      { id:mkId(), name:'helm-charts', repoClass:'local', pkgType:'helm', path:'/chartrepo', children:[{id:mkId(),name:'myapp-chart/0.1.0'},{id:mkId(),name:'infra-chart/1.0.0'}] },
      { id:mkId(), name:'proxy-cache', repoClass:'remote', pkgType:'docker', path:'/proxy', url:'https://registry-1.docker.io', children:[] },
    ],
  }),
  nexus_standard: () => ({
    name:'Nexus — Multi-Format Repository', registryType:'nexus', description:'Sonatype Nexus with Maven, npm, Docker, raw hosted repos',
    repos: [
      { id:mkId(), name:'maven-releases', repoClass:'local', pkgType:'maven', path:'/repository/maven-releases', children:[{id:mkId(),name:'com/mycompany',children:[{id:mkId(),name:'core/1.0/core-1.0.jar'}]}] },
      { id:mkId(), name:'maven-snapshots', repoClass:'local', pkgType:'maven', path:'/repository/maven-snapshots', children:[] },
      { id:mkId(), name:'npm-hosted', repoClass:'local', pkgType:'npm', path:'/repository/npm-hosted', children:[] },
      { id:mkId(), name:'docker-hosted', repoClass:'local', pkgType:'docker', path:'/repository/docker-hosted', children:[{id:mkId(),name:'myapp',children:[{id:mkId(),name:'v1.0.0'}]}] },
      { id:mkId(), name:'raw-hosted', repoClass:'local', pkgType:'generic', path:'/repository/raw-hosted', children:[{id:mkId(),name:'installers',children:[{id:mkId(),name:'app-v1.msi'},{id:mkId(),name:'app-v1.tar.gz'}]}] },
      { id:mkId(), name:'maven-central', repoClass:'remote', pkgType:'maven', path:'/repository/maven-central', url:'https://repo1.maven.org/maven2', children:[] },
      { id:mkId(), name:'npm-proxy', repoClass:'remote', pkgType:'npm', path:'/repository/npm-proxy', url:'https://registry.npmjs.org', children:[] },
      { id:mkId(), name:'maven-group', repoClass:'virtual', pkgType:'maven', path:'/repository/maven-public', includes:['maven-releases','maven-snapshots','maven-central'], children:[] },
    ],
  }),
};

function TreeNode({ node, depth=0, onEdit, onAdd, onDelete }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasKids = node.children && node.children.length > 0;
  // File type icon detection
  const getIcon = (n) => {
    if (n.children !== undefined) return '📂';
    const name = (n.name || '').toLowerCase();
    if (/dockerfile|\.docker|docker/i.test(name)) return '🐳';
    if (/\.jar$|\.war$|\.class$/i.test(name)) return '☕';
    if (/\.js$|\.ts$|\.mjs$/i.test(name)) return '📗';
    if (/\.py$|\.whl$/i.test(name)) return '🐍';
    if (/\.tar\.gz$|\.tgz$|\.zip$|\.bz2$/i.test(name)) return '📦';
    if (/\.exe$|\.msi$|\.bin$|\.so$|\.dll$/i.test(name)) return '⚙️';
    if (/\.json$|\.yaml$|\.yml$|\.toml$|\.xml$/i.test(name)) return '📋';
    if (/\.md$|\.txt$|\.log$|\.csv$/i.test(name)) return '📝';
    if (/\.png$|\.jpg$|\.gif$|\.svg$|\.ico$/i.test(name)) return '🖼️';
    if (/\.rpm$/i.test(name)) return '🐧';
    if (/\.deb$/i.test(name)) return '🔵';
    if (/\.gem$/i.test(name)) return '💎';
    if (/\.nupkg$/i.test(name)) return '💎';
    if (/\.tgz$|chart/i.test(name)) return '☸️';
    if (/latest|v\d|sha256/i.test(name)) return '🏷️';
    return '📄';
  };
  return (
    <div>
      <div className={`tree-row tree-depth-${Math.min(depth,4)}`} style={{ paddingLeft: 12 + depth * 18 }}>
        {hasKids ? <button className="tree-toggle" onClick={()=>setExpanded(!expanded)}>{expanded?'▼':'▶'}</button> : <span className="tree-toggle-placeholder" />}
        <span className="tree-icon">{getIcon(node)}</span>
        <span className="tree-label" onClick={()=>onEdit?.(node)}>{node.name}</span>
        <div className="tree-actions">
          {onAdd && <button className="tree-action-btn" onClick={()=>onAdd(node)} title="Add child">+</button>}
          {onDelete && <button className="tree-action-btn tree-action-del" onClick={()=>onDelete(node)} title="Delete">✕</button>}
        </div>
      </div>
      {expanded && hasKids && node.children.map(c => <TreeNode key={c.id||c.name} node={c} depth={depth+1} onEdit={onEdit} onAdd={onAdd} onDelete={onDelete} />)}
    </div>
  );
}

function RepoCard({ repo, onChange, onDelete, toast }) {
  const [editMode, setEditMode] = useState(false);
  const [addChildModal, setAddChildModal] = useState(null); // parent node
  const [childName, setChildName] = useState('');
  const cls = REPO_CLASSES.find(c=>c.id===repo.repoClass) || REPO_CLASSES[0];
  const pkg = PKG_TYPES.find(p=>p.id===repo.pkgType) || PKG_TYPES[0];

  const [childType, setChildType] = useState('folder'); // 'folder' | 'file'
  const addChild = (parent) => {
    if (!childName.trim()) return;
    const isFolder = childType === 'folder';
    const newChild = { id: mkId(), name: childName.trim(), children: isFolder ? [] : undefined };
    const addToTree = (node) => {
      if (node === parent || node.id === parent?.id) return { ...node, children: [...(node.children||[]), newChild] };
      if (node.children) return { ...node, children: node.children.map(addToTree) };
      return node;
    };
    if (!parent) { onChange({ ...repo, children: [...(repo.children||[]), newChild] }); }
    else { onChange(addToTree(repo)); }
    setAddChildModal(null); setChildName(''); setChildType('folder');
  };
  const deleteNode = (node) => {
    const removeFromTree = (n) => {
      if (!n.children) return n;
      return { ...n, children: n.children.filter(c => c.id !== node.id && c.name !== node.name).map(removeFromTree) };
    };
    onChange(removeFromTree(repo));
  };

  return (
    <div className="repo-card">
      <div className="repo-card-header">
        <span className="repo-class-badge" style={{background:cls.color+'22',color:cls.color,borderColor:cls.color+'44'}}>{cls.icon} {cls.label}</span>
        <span className="repo-pkg-badge">{pkg.icon} {pkg.label}</span>
        <span className="repo-name">{repo.name}</span>
        {repo.url && <span className="repo-url">{repo.url}</span>}
        {repo.includes?.length>0 && <span className="repo-includes">includes: {repo.includes.join(', ')}</span>}
        <div style={{marginLeft:'auto',display:'flex',gap:4}}>
          <button className="btn btn-ghost btn-xs" onClick={()=>setEditMode(!editMode)}>{editMode?'Done':'Edit'}</button>
          <button className="btn btn-ghost btn-xs" onClick={()=>setAddChildModal(null) || setAddChildModal({})}>+ Child</button>
          <button className="btn btn-ghost btn-xs" style={{color:'var(--severity-critical)'}} onClick={()=>onDelete()}>✕</button>
        </div>
      </div>
      {editMode && (
        <div className="repo-edit-panel">
          <div className="config-grid" style={{gap:8}}>
            <div className="config-field"><label>Name</label><input type="text" value={repo.name} onChange={e=>onChange({...repo,name:e.target.value})} /></div>
            <div className="config-field"><label>Class</label><select value={repo.repoClass} onChange={e=>onChange({...repo,repoClass:e.target.value})}>{REPO_CLASSES.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></div>
            <div className="config-field"><label>Package Type</label><select value={repo.pkgType} onChange={e=>onChange({...repo,pkgType:e.target.value})}>{PKG_TYPES.map(p=><option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}</select></div>
          </div>
          {repo.repoClass==='remote' && <div className="config-field" style={{marginTop:8}}><label>Remote URL</label><input type="text" value={repo.url||''} onChange={e=>onChange({...repo,url:e.target.value})} placeholder="https://..." /></div>}
          {repo.repoClass==='virtual' && <div className="config-field" style={{marginTop:8}}><label>Includes (comma-sep)</label><input type="text" value={(repo.includes||[]).join(', ')} onChange={e=>onChange({...repo,includes:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)})} /></div>}
        </div>
      )}
      <div className="repo-tree">
        <div className="tree-row tree-header" style={{paddingLeft:12}}>
          <span className="tree-icon">📂</span><span className="tree-label" style={{fontWeight:600}}>{repo.path || '/'+repo.name}</span>
          <button className="tree-action-btn" style={{marginLeft:'auto'}} onClick={()=>{setAddChildModal({});setChildName('');}}>+ Item</button>
        </div>
        {(repo.children||[]).map(c => <TreeNode key={c.id||c.name} node={c} onEdit={()=>{}} onAdd={(p)=>{setAddChildModal(p);setChildName('');}} onDelete={deleteNode} />)}
        {(!repo.children||repo.children.length===0)&&<div className="tree-empty">Empty repository</div>}
      </div>
      {addChildModal!==null && <div className="modal-overlay" onClick={()=>setAddChildModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><h3>Add Item to Repository</h3><button className="btn-icon" onClick={()=>setAddChildModal(null)}>✕</button></div>
        <div className="modal-body">
          <div className="config-field" style={{marginBottom:12}}>
            <label>Type</label>
            <div style={{display:'flex',gap:8,marginTop:6}}>
              {[{id:'folder',icon:'📂',label:'Folder'},{id:'file',icon:'📄',label:'File'}].map(opt=>(
                <button key={opt.id} type="button"
                  onClick={()=>setChildType(opt.id)}
                  style={{flex:1,padding:'10px 8px',border:`2px solid ${childType===opt.id?'var(--accent-primary)':'var(--border-subtle)'}`,borderRadius:8,background:childType===opt.id?'rgba(108,92,231,.1)':'var(--bg-input)',color:'var(--text-primary)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,fontSize:13,fontWeight:childType===opt.id?600:400,transition:'all .2s'}}>
                  <span style={{fontSize:18}}>{opt.icon}</span>{opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="config-field">
            <label>{childType === 'folder' ? '📂 Folder Name' : '📄 File Name'}</label>
            <input type="text"
              placeholder={childType === 'folder' ? 'e.g. com, releases, v1.0.0' : 'e.g. app-1.0.jar, Dockerfile, config.yaml'}
              value={childName} onChange={e=>setChildName(e.target.value)} autoFocus
              onKeyDown={e=>{if(e.key==='Enter')addChild(addChildModal?.id?addChildModal:null);}}/>
            {childType==='file' && <div style={{marginTop:8,display:'flex',flexWrap:'wrap',gap:6}}>
              {['*.jar','*.tar.gz','Dockerfile','*.yaml','*.json','*.sh','*.png','*.deb','*.rpm'].map(ext=>(
                <button key={ext} type="button" onClick={()=>setChildName(ext.replace('*','app'))}
                  style={{fontSize:10,padding:'2px 8px',border:'1px solid var(--border-subtle)',borderRadius:12,background:'var(--bg-elevated)',color:'var(--text-secondary)',cursor:'pointer',fontFamily:"'JetBrains Mono',monospace"}}>
                  {ext}
                </button>
              ))}
            </div>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={()=>setAddChildModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>addChild(addChildModal?.id?addChildModal:null)} disabled={!childName.trim()}>
            Add {childType === 'folder' ? '📂 Folder' : '📄 File'}
          </button>
        </div>
      </div></div>}
    </div>
  );
}

/* ═══════════ REGISTRY INSTANCE ═══════════ */
function RegistryInstance({ registry, onChange, onDelete, toast }) {
  const repos = registry.repos || [];
  const [addRepo, setAddRepo] = useState(false);
  const [newRepo, setNewRepo] = useState({ name:'', repoClass:'local', pkgType:'generic' });
  const regType = REGISTRY_TYPES.find(r=>r.id===registry.registryType) || REGISTRY_TYPES[0];
  const importRef = useRef(null);

  const doAddRepo = () => {
    if (!newRepo.name.trim()) return;
    onChange({ ...registry, repos: [...repos, { id:mkId(), name:newRepo.name.trim(), repoClass:newRepo.repoClass, pkgType:newRepo.pkgType, path:'/'+newRepo.name.trim(), children:[] }] });
    setAddRepo(false); setNewRepo({name:'',repoClass:'local',pkgType:'generic'});
  };
  const importReg = (e) => {
    const file = e.target.files?.[0]; if(!file)return;
    const reader = new FileReader(); reader.onload = ev => {
      try { const d = JSON.parse(ev.target.result); if(d.repos) onChange({...registry,...d,id:registry.id}); toast?.('Imported','success'); } catch(err){ toast?.('Import failed','error'); }
    }; reader.readAsText(file); e.target.value='';
  };

  return (
    <div className="workflow-card">
      <div className="workflow-header">
        <div style={{flex:1}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
            <span style={{fontSize:24}}>{regType.icon}</span>
            <input className="pipeline-title-input" style={{fontSize:20}} value={registry.name} onChange={e=>onChange({...registry,name:e.target.value})} placeholder="Registry name" />
          </div>
          <input className="pipeline-desc-input" value={registry.description||''} onChange={e=>onChange({...registry,description:e.target.value})} placeholder="Description..." />
        </div>
        <div style={{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}}>
          <span className="workflow-badge" style={{background:regType.color+'22',color:regType.color}}>{regType.name}</span>
          <select className="conn-add-select" value={registry.registryType} onChange={e=>onChange({...registry,registryType:e.target.value})}>{REGISTRY_TYPES.map(r=><option key={r.id} value={r.id}>{r.icon} {r.name}</option>)}</select>
          <button className="btn btn-ghost btn-xs" onClick={()=>setAddRepo(true)}>+ Repo</button>
          <button className="btn btn-ghost btn-xs" onClick={()=>{exportAsJSON({name:registry.name,registryType:registry.registryType,description:registry.description,repos},registry.name||'registry');toast?.('Exported','success');}}>📄</button>
          <button className="btn btn-ghost btn-xs" onClick={()=>importRef.current?.click()}>📥</button>
          <input ref={importRef} type="file" accept=".json" style={{display:'none'}} onChange={importReg}/>
          <button className="btn btn-ghost btn-xs" style={{color:'var(--severity-critical)'}} onClick={()=>{if(window.confirm('Delete registry?'))onDelete();}}>Delete</button>
        </div>
      </div>
      {/* Repo class legend */}
      <div className="pipeline-legend" style={{margin:'12px 16px 0',padding:'8px 12px'}}>{REPO_CLASSES.map(c=><div key={c.id} className="pipeline-legend-item"><span className="pipeline-legend-dot" style={{background:c.color}}/><span>{c.icon} {c.label}</span><span style={{color:'var(--text-muted)',fontSize:10}}>— {c.desc}</span></div>)}</div>
      <div className="workflow-pipelines">
        {repos.map((r,i) => <RepoCard key={r.id} repo={r}
          onChange={up=>{const n=[...repos];n[i]=up;onChange({...registry,repos:n});}}
          onDelete={()=>onChange({...registry,repos:repos.filter((_,j)=>j!==i)})} toast={toast} />)}
        {repos.length===0 && <div className="empty-state" style={{padding:'30px 20px'}}><p>No repositories. Add one to start.</p></div>}
      </div>
      {addRepo && <div className="modal-overlay" onClick={()=>setAddRepo(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><h3>Add Repository</h3><button className="btn-icon" onClick={()=>setAddRepo(false)}>✕</button></div>
        <div className="modal-body">
          <div className="config-field"><label>Name *</label><input type="text" placeholder="e.g. docker-local" value={newRepo.name} onChange={e=>setNewRepo(p=>({...p,name:e.target.value}))}/></div>
          <div className="config-grid" style={{gap:8,marginTop:8}}>
            <div className="config-field"><label>Class</label><select value={newRepo.repoClass} onChange={e=>setNewRepo(p=>({...p,repoClass:e.target.value}))}>{REPO_CLASSES.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}</select></div>
            <div className="config-field"><label>Package Type</label><select value={newRepo.pkgType} onChange={e=>setNewRepo(p=>({...p,pkgType:e.target.value}))}>{PKG_TYPES.map(p=><option key={p.id} value={p.id}>{p.icon} {p.label}</option>)}</select></div>
          </div>
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setAddRepo(false)}>Cancel</button><button className="btn btn-primary" onClick={doAddRepo} disabled={!newRepo.name.trim()}>Add</button></div>
      </div></div>}
    </div>
  );
}

/* ═══════════ MAIN ═══════════ */
const ArtifactRegistry = ({ data, setData, toast }) => {
  const d = data || { registries: [] };
  const registries = d.registries || [];
  const [showPicker, setShowPicker] = useState(false);
  const persist = useCallback(r=>setData({...d,registries:r}),[d,setData]);

  const addDefault = (key) => {
    const fn = DEFAULT_REGISTRIES[key]; if(!fn)return;
    const t = fn(); persist([...registries, { id:mkId(), ...t }]);
    setShowPicker(false); toast?.(`"${t.name}" added`,'success');
  };
  const addBlank = (regType) => {
    persist([...registries, { id:mkId(), name:'New Registry', registryType:regType, description:'', repos:[] }]);
    setShowPicker(false);
  };

  return (
    <div className="animate-in">
      <div className="section-header"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div><h2>Artifact Registries</h2><p>Model artifact repository layouts — JFrog Artifactory, Harbor, or Nexus with folder trees, repo classes, and package types.</p></div>
        <button className="btn btn-primary" onClick={()=>setShowPicker(true)}>+ Registry</button>
      </div></div>
      {registries.length===0 && <div className="empty-state" style={{marginTop:40}}><div style={{fontSize:48,marginBottom:16}}>📦</div><h3>No Registries</h3><p>Select a registry type to get started.</p><button className="btn btn-primary" style={{marginTop:16}} onClick={()=>setShowPicker(true)}>+ Add Registry</button></div>}
      {registries.map((r,i) => <RegistryInstance key={r.id} registry={r} onChange={up=>{const n=[...registries];n[i]=up;persist(n);}} onDelete={()=>{persist(registries.filter((_,j)=>j!==i));toast?.('Deleted','success');}} toast={toast} />)}
      {showPicker && <div className="modal-overlay" onClick={()=>setShowPicker(false)}><div className="modal modal-lg" onClick={e=>e.stopPropagation()}>
        <div className="modal-header"><h3>Add Registry</h3><button className="btn-icon" onClick={()=>setShowPicker(false)}>✕</button></div>
        <div className="modal-body"><div className="template-picker-grid">
          {REGISTRY_TYPES.map(rt=><button key={rt.id} className="template-picker-card" onClick={()=>addBlank(rt.id)}><div className="tpl-pick-icon">{rt.icon}</div><div className="tpl-pick-info"><h4>{rt.name}</h4><p>Empty registry — add repos manually</p></div></button>)}
          <div style={{gridColumn:'1/-1',borderTop:'1px solid var(--border-subtle)',margin:'8px 0',paddingTop:12}}><span style={{fontSize:11,color:'var(--text-muted)',fontFamily:"'JetBrains Mono',monospace",textTransform:'uppercase',letterSpacing:'.5px'}}>Or start from a template</span></div>
          {Object.entries(DEFAULT_REGISTRIES).map(([key,fn])=>{const t=fn();const rt=REGISTRY_TYPES.find(r=>r.id===t.registryType);return<button key={key} className="template-picker-card blank" onClick={()=>addDefault(key)}><div className="tpl-pick-icon">{rt?.icon||'📦'}</div><div className="tpl-pick-info"><h4>{t.name}</h4><p>{t.description}</p><span className="tpl-pick-count">{t.repos.length} repos</span></div></button>;})}
        </div></div>
      </div></div>}
    </div>
  );
};
export default ArtifactRegistry;
