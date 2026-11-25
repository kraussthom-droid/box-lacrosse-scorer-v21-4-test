/* V17 approved compact scoreboard report. Read-only; shared IndexedDB with scorer. */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const events=g=>(g.events||[]).filter(e=>!e.deleted);
const name=(g,t)=>t===0?g.home.name:g.away.name;
const displayGameDateTime=(date,time)=>{
 const d=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date||''));
 const dateText=d?new Date(Date.UTC(+d[1],+d[2]-1,+d[3])).toLocaleDateString('en-US',{timeZone:'UTC',month:'long',day:'numeric',year:'numeric'}):String(date||'Date not recorded');
 const t=/^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(time||''));
 const timeText=t?`${(+t[1]%12)||12}:${t[2]} ${+t[1]>=12?'PM':'AM'}`:String(time||'Time not recorded');
 return `${dateText} · ${timeText}`;
};
// Soccer-style minute: use the stored scoring minute when seconds were entered;
// otherwise display the exact whole elapsed minute, without invented seconds.
const elapsed=e=>{const n=Number(e.elapsed);let seconds=Number.isFinite(n)&&e.elapsed!=null?n:null;if(seconds===null){const m=/^(\d+):(\d{2}|--)$/.exec(String(e.remaining||''));if(!m)return '—';seconds=720-(Number(m[1])*60+(m[2]==='--'?0:Number(m[2])))}const minute=e.secondsKnown===false||String(e.remaining||'').endsWith(':--')?Math.floor(seconds/60):Math.ceil(seconds/60);return `${Math.max(0,minute)}′`};
// The report runs entirely offline. Match the scorer's team IDs and player IDs,
// and fall back to the bundled league rosters for older/local games.
const teamKey=(g,t)=>{const team=t===0?g.home:g.away;return (typeof LEAGUE_DATA!=='undefined'?LEAGUE_DATA.teams.find(x=>x.name.toLowerCase()===String(team.name).toLowerCase())?.id:null)||String(team.name).toLowerCase().replace(/\s+/g,'-')};
const roster=(data,g,t)=>{const key=teamKey(g,t),team=t===0?g.home:g.away;const snapshot=g.rosterSnapshot?.[key]||g.rosterSnapshot?.[team.id];if(Array.isArray(snapshot))return snapshot;const seed=(typeof LEAGUE_DATA!=='undefined'?LEAGUE_DATA.teams.find(x=>x.id===key||x.name.toLowerCase()===String(team.name).toLowerCase())?.roster:[])||[];const stored=data.rosters?.[key]||data.rosters?.[team.id]||[];const map=new Map();for(const r of seed)map.set(String(r.id||r.jersey),r);for(const r of stored)map.set(String(r.id||r.jersey),r);return [...map.values()]};
const properName=value=>String(value||'').trim().split(/(\s+|[-’'])/).map(part=>{if(!/[a-z]/i.test(part))return part;if(/[a-z]/.test(part)&&/[A-Z]/.test(part.slice(1))&&part!==part.toUpperCase())return part;return part[0].toLocaleUpperCase()+part.slice(1).toLocaleLowerCase()}).join('');
const player=(data,g,t,id,num)=>{const rs=roster(data,g,t);return (id&&rs.find(r=>String(r.id)===String(id)))||rs.find(r=>String(r.jersey)===String(num))};
const abbrev=(g,t)=>{const a=name(g,0),b=name(g,1);const make=n=>n.split(/\s+/).map(w=>w[0]).join('').toUpperCase();const initial=make(t?b:a);if(make(a)!==make(b))return initial;const word=String(t?b:a).replace(/[^a-z0-9]/gi,'').toUpperCase();return word.slice(0,3)||String(t+1)};
const ordered=arr=>arr.slice().sort((a,b)=>(Number(a.quarter)||0)-(Number(b.quarter)||0)||(Number(a.elapsed)||0)-(Number(b.elapsed)||0)||String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
const count=(ev,type,t,q)=>ev.filter(e=>e.type===type&&e.team===t&&(q==null||e.quarter===q)).length;
function tbl(headers,rows,cls=''){return `<table class="${cls}"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="empty">No entries</td></tr>`}</tbody></table>`}
const jersey=n=>n==null||String(n).trim()===''?'—':'#'+String(n);
function playerRows(data,g,ev,t){
 const rs=roster(data,g,t),att=g.attendance?.[teamKey(g,t)]||g.attendance?.[(t===0?g.home:g.away).id]||{};
 const dressed=rs.filter(r=>att[r.id]!==false);
 const stats=new Map();const keyOf=(id,num)=>String(id||'jersey:'+String(num??''));
 const ensure=(id,num)=>{if(!id&&!String(num??'').trim())return null;const r=player(data,g,t,id,num),k=keyOf(r?.id||id,r?.jersey||num);if(!stats.has(k))stats.set(k,{g:0,a:0,pim:0,r:r||{id:id||'',jersey:String(num),name:''}});return stats.get(k)};
 for(const e of ev.filter(e=>e.team===t)){
  if(e.type==='goal'){const s=ensure(e.scorerId,e.scorer);if(s)s.g++;if(e.assist){const a=ensure(e.assistId,e.assist);if(a)a.a++}}
  if(e.type==='penalty'){const s=ensure(e.playerId,e.player);if(s)s.pim+=Number(e.duration)||0}
 }
 const entries=dressed.map(r=>({r,s:stats.get(keyOf(r.id,r.jersey))||{g:0,a:0,pim:0}}));
 const seen=new Set(entries.map(x=>keyOf(x.r.id,x.r.jersey)));
 for(const [k,s] of stats)if(!seen.has(k))entries.push({r:s.r,s});
 entries.sort((a,b)=>Number(a.r.jersey)-Number(b.r.jersey)||String(a.r.jersey).localeCompare(String(b.r.jersey)));
 let total=[0,0,0];const rows=entries.map(({r,s})=>{total[0]+=s.g;total[1]+=s.a;total[2]+=s.pim;return [r.jersey,properName(r.name||'(name unavailable)')+(r.goalie?' (G)':''),s.g||'',s.a||'',s.g+s.a||'',s.pim||'']});
 rows.push(['','TOTAL',total[0],total[1],total[0]+total[1],total[2]]);return rows;
}
function goalieRows(data,g,ev,t){const rs=roster(data,g,t),att=g.attendance?.[teamKey(g,t)]||g.attendance?.[(t===0?g.home:g.away).id]||{};const m=new Map();const ensure=n=>{n=String(n??'').trim();if(!n)return null;if(!m.has(n))m.set(n,{n,s:[0,0,0,0],ga:0});return m.get(n)};for(const r of rs)if(r.goalie&&att[r.id]!==false)ensure(r.jersey);ensure((t===0?g.home:g.away).goalie);for(const e of ev){if(e.type==='goalie_change'&&e.team===t)ensure(e.goalie);if(e.type==='save'&&e.team===t){const x=ensure(e.goalie);if(x&&e.quarter>=1&&e.quarter<=4)x.s[e.quarter-1]++}if(e.type==='goal'&&e.team===1-t){const x=ensure(e.goalieAgainst);if(x)x.ga++}}return [...m.values()].map(x=>{const sv=x.s.reduce((a,b)=>a+b,0),r=rs.find(r=>String(r.jersey)===x.n);return [x.n,properName(r?.name||''),...x.s,sv,x.ga,sv+x.ga?(100*sv/(sv+x.ga)).toFixed(1)+'%':'—']})}
function build(data,g){const ev=events(g),goals=ordered(ev.filter(e=>e.type==='goal')),pen=ordered(ev.filter(e=>e.type==='penalty'));const totals=[0,1].map(t=>count(ev,'goal',t));const short=t=>abbrev(g,t);let running=[0,0];const scoreRows=goals.map(e=>{running[e.team]++;return [e.quarter,elapsed(e),short(e.team),jersey(e.scorer),e.assist?jersey(e.assist):'—',running[0]+'–'+running[1]]});const penRows=pen.map(e=>[e.quarter,elapsed(e),short(e.team),jersey(e.player),e.infraction||'Other',Number(e.duration)||1]);const quarterRows=[0,1].map(t=>[name(g,t),...[1,2,3,4].map(q=>count(ev,'goal',t,q)),totals[t]]);const refs=(g.referees||[]).filter(Boolean);const status=g.status==='final'?'FINAL':'LIVE / UNOFFICIAL';document.title=`716 Lacrosse — ${name(g,0)} vs ${name(g,1)} — ${g.date||''}`;document.getElementById('report').innerHTML=`
<div class="mast"><img src="716-lacrosse-logo.png" alt="716 Lacrosse"/><div class="identity"><h1>716 LACROSSE</h1><b>GAME SHEET</b><div>${esc(displayGameDateTime(g.date,g.scheduledStart))}</div><div>${esc(name(g,0))} vs. ${esc(name(g,1))}</div></div><section class="quarter-box"><h2>FINAL SCORE · SCORING BY QUARTER</h2>${tbl(['TEAM','Q1','Q2','Q3','Q4','FINAL'],quarterRows)}<div class="officials"><b>OFFICIALS</b> &nbsp; ${refs.length?refs.map(esc).join(' · '):'Not recorded'} <span class="status">${esc(status)}</span></div></section></div>
<div class="columns summaries"><section><h2>SCORING SUMMARY</h2>${tbl(['Q','TIME','TEAM','SCORED BY','ASSIST','H–A'],scoreRows)}</section><section><h2>PENALTY SUMMARY</h2>${tbl(['Q','TIME','TEAM','PLAYER','OFFENCE','MIN'],penRows)}<div class="small right">Penalties: ${pen.length} · Minutes: ${pen.reduce((n,e)=>n+(Number(e.duration)||1),0)}</div></section></div>
<div class="columns rosters">${[0,1].map(t=>`<section><h2>${esc(name(g,t).toUpperCase())} ROSTER</h2>${tbl(['#','NAME','G','A','PTS','PIM'],playerRows(data,g,ev,t))}</section>`).join('')}</div>
<div class="columns goalies">${[0,1].map(t=>`<section><h2>${esc(name(g,t).toUpperCase())} GOALIES</h2>${tbl(['#','NAME','SV1','SV2','SV3','SV4','SV','GA','SV%'],goalieRows(data,g,ev,t))}</section>`).join('')}</div>
<div class="small foot">Times show elapsed minutes (′) within each 12-minute quarter. Roster lists dressed players, including those with no recorded statistics. Goalie goals against require a recorded goalie assignment. ${g.status==='final'?'Finalized game.':'In-progress report — not final.'}</div>`}
(async()=>{try{const id=new URLSearchParams(location.search).get('game');if(!id)throw Error('No game selected');const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('box-lacrosse-v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onupgradeneeded=()=>reject(Error('No scoring database found'))});const data=await new Promise((resolve,reject)=>{const r=db.transaction('state').objectStore('state').get('app');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const game=data?.games?.find(g=>g.id===id);if(!game)throw Error('Game not found in this device’s saved games');build(data,game)}catch(e){document.getElementById('report').textContent='Unable to load report: '+e.message}})();
