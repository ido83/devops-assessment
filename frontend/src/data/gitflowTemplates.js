import { mkId } from '../utils/graphEngine';
function tpl(fn) { const ids={}; const mk=(k)=>{ids[k]=mkId();return ids[k];}; return fn(mk,ids); }

export const GITFLOW_TEMPLATES = {
  feature_branch: ()=>tpl((mk,ids)=>({
    name:'Feature Branch (Git Flow)',
    description:'Classic Git Flow — feature, develop, release, hotfix, main branches',
    nodes:[
      {id:mk('m1'),label:'main',type:'branch',sub:'Production branch',color:'#ff3b5c'},
      {id:mk('d1'),label:'develop',type:'branch',sub:'Integration branch',color:'#6c5ce7'},
      {id:mk('f1'),label:'feature/login',type:'branch',sub:'Feature branch',color:'#00cec9'},
      {id:mk('f2'),label:'feature/api',type:'branch',sub:'Feature branch',color:'#00cec9'},
      {id:mk('c1'),label:'commit A',type:'commit',sub:'Initial feature work'},
      {id:mk('c2'),label:'commit B',type:'commit',sub:'API endpoint work'},
      {id:mk('mr1'),label:'MR → develop',type:'merge',sub:'Code review + CI pass'},
      {id:mk('mr2'),label:'MR → develop',type:'merge',sub:'Code review + CI pass'},
      {id:mk('r1'),label:'release/1.0',type:'branch',sub:'Release branch',color:'#ff8c42'},
      {id:mk('t1'),label:'QA + Fix',type:'commit',sub:'Bug fixes on release'},
      {id:mk('mr3'),label:'MR → main',type:'merge',sub:'Release merge'},
      {id:mk('tag1'),label:'v1.0.0',type:'tag',sub:'Production tag'},
      {id:mk('h1'),label:'hotfix/1.0.1',type:'branch',sub:'Hotfix branch',color:'#fd79a8'},
      {id:mk('hc1'),label:'hotfix commit',type:'commit',sub:'Critical fix'},
      {id:mk('mr4'),label:'MR → main + develop',type:'merge',sub:'Hotfix merge back'},
    ],
    edges:[
      {from:ids.m1,to:ids.d1},{from:ids.d1,to:ids.f1},{from:ids.d1,to:ids.f2},
      {from:ids.f1,to:ids.c1},{from:ids.f2,to:ids.c2},
      {from:ids.c1,to:ids.mr1},{from:ids.c2,to:ids.mr2},
      {from:ids.mr1,to:ids.r1},{from:ids.mr2,to:ids.r1},
      {from:ids.r1,to:ids.t1},{from:ids.t1,to:ids.mr3},
      {from:ids.mr3,to:ids.tag1},
      {from:ids.m1,to:ids.h1},{from:ids.h1,to:ids.hc1},{from:ids.hc1,to:ids.mr4},
    ],
  })),

  trunk_based: ()=>tpl((mk,ids)=>({
    name:'Trunk-Based Development',
    description:'Short-lived feature branches, frequent merges to trunk/main, feature flags',
    nodes:[
      {id:mk('m1'),label:'main (trunk)',type:'branch',sub:'Single source of truth',color:'#ff3b5c'},
      {id:mk('f1'),label:'feat/short-1',type:'branch',sub:'Short-lived (< 1 day)',color:'#00cec9'},
      {id:mk('f2'),label:'feat/short-2',type:'branch',sub:'Short-lived (< 1 day)',color:'#00cec9'},
      {id:mk('c1'),label:'small commit',type:'commit',sub:'Incremental change'},
      {id:mk('c2'),label:'small commit',type:'commit',sub:'Incremental change'},
      {id:mk('mr1'),label:'PR → main',type:'merge',sub:'Fast-forward merge'},
      {id:mk('mr2'),label:'PR → main',type:'merge',sub:'Fast-forward merge'},
      {id:mk('ff1'),label:'Feature Flag',type:'tag',sub:'Toggle via LaunchDarkly/Split'},
      {id:mk('d1'),label:'CI → Deploy',type:'merge',sub:'Auto-deploy on green trunk'},
      {id:mk('r1'),label:'Release Cut',type:'tag',sub:'Tag from trunk'},
    ],
    edges:[
      {from:ids.m1,to:ids.f1},{from:ids.m1,to:ids.f2},
      {from:ids.f1,to:ids.c1},{from:ids.f2,to:ids.c2},
      {from:ids.c1,to:ids.mr1},{from:ids.c2,to:ids.mr2},
      {from:ids.mr1,to:ids.ff1},{from:ids.mr2,to:ids.ff1},
      {from:ids.ff1,to:ids.d1},{from:ids.d1,to:ids.r1},
    ],
  })),

  github_flow: ()=>tpl((mk,ids)=>({
    name:'GitHub Flow',
    description:'Simple flow — main + feature branches, PR reviews, deploy from main',
    nodes:[
      {id:mk('m1'),label:'main',type:'branch',sub:'Always deployable',color:'#ff3b5c'},
      {id:mk('f1'),label:'feature/new-ui',type:'branch',sub:'Descriptive branch name',color:'#00cec9'},
      {id:mk('c1'),label:'commit 1',type:'commit',sub:'Implement feature'},
      {id:mk('c2'),label:'commit 2',type:'commit',sub:'Add tests'},
      {id:mk('pr1'),label:'Open PR',type:'merge',sub:'Request review'},
      {id:mk('ci1'),label:'CI Checks',type:'commit',sub:'Automated tests pass'},
      {id:mk('rv1'),label:'Code Review',type:'tag',sub:'Team review + approve'},
      {id:mk('mr1'),label:'Merge → main',type:'merge',sub:'Squash or merge commit'},
      {id:mk('d1'),label:'Auto Deploy',type:'merge',sub:'Deploy to production'},
    ],
    edges:[
      {from:ids.m1,to:ids.f1},{from:ids.f1,to:ids.c1},{from:ids.c1,to:ids.c2},
      {from:ids.c2,to:ids.pr1},{from:ids.pr1,to:ids.ci1},{from:ids.ci1,to:ids.rv1},
      {from:ids.rv1,to:ids.mr1},{from:ids.mr1,to:ids.d1},
    ],
  })),

  gitlab_flow: ()=>tpl((mk,ids)=>({
    name:'GitLab Flow',
    description:'Environment branches — main → pre-production → production with MR promotion',
    nodes:[
      {id:mk('m1'),label:'main',type:'branch',sub:'Development branch',color:'#6c5ce7'},
      {id:mk('f1'),label:'feature/auth',type:'branch',sub:'Feature branch',color:'#00cec9'},
      {id:mk('c1'),label:'commits',type:'commit',sub:'Feature implementation'},
      {id:mk('mr1'),label:'MR → main',type:'merge',sub:'Code review + CI'},
      {id:mk('pp1'),label:'pre-production',type:'branch',sub:'Staging environment',color:'#ff8c42'},
      {id:mk('mr2'),label:'MR → pre-prod',type:'merge',sub:'Promote to staging'},
      {id:mk('t1'),label:'QA Testing',type:'commit',sub:'Manual + automated QA'},
      {id:mk('p1'),label:'production',type:'branch',sub:'Production environment',color:'#ff3b5c'},
      {id:mk('mr3'),label:'MR → production',type:'merge',sub:'Release promotion'},
      {id:mk('tag1'),label:'v1.0.0',type:'tag',sub:'Release tag'},
    ],
    edges:[
      {from:ids.m1,to:ids.f1},{from:ids.f1,to:ids.c1},{from:ids.c1,to:ids.mr1},
      {from:ids.mr1,to:ids.pp1},{from:ids.pp1,to:ids.mr2},
      {from:ids.mr2,to:ids.t1},{from:ids.t1,to:ids.p1},
      {from:ids.p1,to:ids.mr3},{from:ids.mr3,to:ids.tag1},
    ],
  })),

  release_branch: ()=>tpl((mk,ids)=>({
    name:'Release Branching',
    description:'Long-lived release branches for versioned products with cherry-pick hotfixes',
    nodes:[
      {id:mk('m1'),label:'main',type:'branch',sub:'Development trunk',color:'#6c5ce7'},
      {id:mk('r1'),label:'release/2.x',type:'branch',sub:'Release 2.x line',color:'#ff8c42'},
      {id:mk('r2'),label:'release/3.x',type:'branch',sub:'Release 3.x line',color:'#ff8c42'},
      {id:mk('c1'),label:'feature work',type:'commit',sub:'New development on main'},
      {id:mk('cp1'),label:'cherry-pick',type:'merge',sub:'Backport fix to 2.x'},
      {id:mk('tag1'),label:'v2.1.1',type:'tag',sub:'Patch release'},
      {id:mk('tag2'),label:'v3.0.0',type:'tag',sub:'Major release'},
      {id:mk('c2'),label:'release prep',type:'commit',sub:'Version bump + changelog'},
    ],
    edges:[
      {from:ids.m1,to:ids.r1},{from:ids.m1,to:ids.r2},{from:ids.m1,to:ids.c1},
      {from:ids.c1,to:ids.cp1},{from:ids.cp1,to:ids.tag1},
      {from:ids.r2,to:ids.c2},{from:ids.c2,to:ids.tag2},
    ],
  })),

  forking_flow: ()=>tpl((mk,ids)=>({
    name:'Forking Workflow (Open Source)',
    description:'Fork-based contributions — upstream/downstream with PR back to upstream',
    nodes:[
      {id:mk('u1'),label:'upstream/main',type:'branch',sub:'Official repository',color:'#ff3b5c'},
      {id:mk('fk1'),label:'fork/main',type:'branch',sub:'Developer\'s fork',color:'#6c5ce7'},
      {id:mk('f1'),label:'feature/contrib',type:'branch',sub:'Feature in fork',color:'#00cec9'},
      {id:mk('c1'),label:'commits',type:'commit',sub:'Contribution work'},
      {id:mk('pr1'),label:'PR → upstream',type:'merge',sub:'Cross-repo PR'},
      {id:mk('rv1'),label:'Maintainer Review',type:'tag',sub:'Review + approve'},
      {id:mk('mr1'),label:'Merge → upstream',type:'merge',sub:'Accepted contribution'},
      {id:mk('sy1'),label:'Sync Fork',type:'commit',sub:'git pull upstream main'},
    ],
    edges:[
      {from:ids.u1,to:ids.fk1},{from:ids.fk1,to:ids.f1},{from:ids.f1,to:ids.c1},
      {from:ids.c1,to:ids.pr1},{from:ids.pr1,to:ids.rv1},{from:ids.rv1,to:ids.mr1},
      {from:ids.mr1,to:ids.sy1},
    ],
  })),
};

export const GITFLOW_NODE_COLORS = {
  branch:'#6c5ce7', commit:'#ffd166', merge:'#00cec9', tag:'#ff8c42',
};
export const GITFLOW_NODE_ICONS = {
  branch:'🌿', commit:'📝', merge:'🔀', tag:'🏷️',
};

export const GITFLOW_TEMPLATE_LIST = [
  { key:'feature_branch', icon:'🌿', cat:'Classic' },
  { key:'trunk_based', icon:'🪵', cat:'Modern' },
  { key:'github_flow', icon:'🐙', cat:'Simple' },
  { key:'gitlab_flow', icon:'🦊', cat:'Env-Based' },
  { key:'release_branch', icon:'📦', cat:'Versioned' },
  { key:'forking_flow', icon:'🍴', cat:'Open Source' },
];
