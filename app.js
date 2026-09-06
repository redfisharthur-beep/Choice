const cfg=window.CHOICE_CONFIG||{apiBase:'',realtimeEnabled:false,lineOfficialUrl:''};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const makeId=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const clientId=localStorage.getItem('choice-client-id')||makeId();localStorage.setItem('choice-client-id',clientId);
const stateKey='choice-app-v4';
const blank={title:'今晚吃什麼？',options:[],myVote:null,recent:[],roomCode:null,roomPassword:'',hostToken:'',displayName:'訪客',lastDraw:null,phase:'setup'};
let data=load(),selectedVote=data.myVote||null,drawSelected=new Set(),roomSocket=null,roomMembers=[],throwing=false,pendingJoinCode='',micStream=null,audioCtx=null,analyser=null,meterRAF=null,isHost=false;
function load(){try{return {...blank,...JSON.parse(localStorage.getItem(stateKey)||'{}')}}catch{return {...blank}}}
function save(){localStorage.setItem(stateKey,JSON.stringify(data))}
function api(path){return `${cfg.apiBase||''}${path}`}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1800)}
function totalVotes(){return data.options.reduce((a,o)=>a+(o.votes||0),0)}
function topChoice(){const s=[...data.options].sort((a,b)=>(b.votes||0)-(a.votes||0));return s[0]&&s[0].votes?s[0]:null}
function phaseStep(){return data.phase==='voting'?'vote':data.phase==='closed'?'analysis':data.phase==='draw'?'draw':'setup'}

async function loadRoomList(){
  const list=$('#roomList');if(!list||data.roomCode)return;
  try{const r=await fetch(api('/api/rooms'),{cache:'no-store'}),j=await r.json();if(!r.ok)throw new Error(j.error||'讀取失敗');const rooms=Array.isArray(j.rooms)?j.rooms:[];list.innerHTML=rooms.map(room=>`<button class="room-list-item" type="button" data-room-code="${esc(room.code)}"><span class="room-list-name">${esc(room.title||'未命名房間')}</span><span class="room-list-meta">${room.locked?'🔒':'進入'}</span></button>`).join('')}catch{list.innerHTML=''}
}

function render(){
  $('#homeView').classList.toggle('hidden',!!data.roomCode);$('#roomView').classList.toggle('hidden',!data.roomCode);
  $('#roomTitle').textContent=data.title||'我的 Choice';$('#roomCodeText').textContent=data.roomCode||'——';$('#participantCount').textContent=`${Math.max(1,roomMembers.length)} 人`;
  $('#roleBadge').textContent=isHost?'房主':'參與者';$('#roleBadge').classList.toggle('host',isHost);
  $('#pollTitleDisplay').textContent=data.title||'投票';
  $('#optionInput').disabled=!isHost||data.phase!=='setup';$('#addOptionBtn').disabled=!isHost||data.phase!=='setup';
  $('#setupOptions').innerHTML=data.options.map(o=>`<span class="setup-chip">${esc(o.name)}${isHost&&data.phase==='setup'?`<button data-remove="${o.id}">×</button>`:''}</span>`).join('')||'<span class="small-note">先加入 2 個以上項目</span>';
  $('#goVoteBtn').classList.toggle('hidden',!isHost||data.phase!=='setup');$('#goDrawBtn').classList.toggle('hidden',!isHost||data.phase!=='setup');
  $('#voteOptions').innerHTML=data.options.map(o=>`<button class="vote-option ${selectedVote===o.id?'selected':''}" data-vote="${o.id}" ${data.phase!=='voting'?'disabled':''}>${esc(o.name)} · ${o.votes||0}票</button>`).join('');
  $('#voteBtn').disabled=!selectedVote||data.options.length<2||data.phase!=='voting';$('#closeVoteBtn').classList.toggle('hidden',!isHost||data.phase!=='voting');
  const total=totalVotes();$('#chartList').innerHTML=data.options.map(o=>{const p=total?Math.round((o.votes||0)/total*100):0;return `<div class="bar-row"><div class="bar-label">${esc(o.name)}</div><div class="bar-track"><div class="bar-fill" style="width:${p}%"></div></div><div class="bar-value">${p}%</div></div>`}).join('')||'<p class="small-note">尚未投票</p>';
  const top=topChoice();$('#insightText').textContent=top?`目前第一名：${top.name}（${top.votes} 票）`:'尚未投票';
  $('#analysisDrawBtn').classList.toggle('hidden',!isHost);$('#announceVoteBtn').classList.toggle('hidden',!isHost);
  if(!drawSelected.size)data.options.forEach(o=>drawSelected.add(o.id));for(const id of [...drawSelected])if(!data.options.some(o=>o.id===id))drawSelected.delete(id);
  $('#drawChecks').innerHTML=data.options.map(o=>`<label class="draw-check"><input type="checkbox" data-draw="${o.id}" ${drawSelected.has(o.id)?'checked':''} ${!isHost?'disabled':''}>${esc(o.name)}</label>`).join('');
  $('#throwBtn').classList.toggle('hidden',!isHost);$('#drawResult').textContent=data.lastDraw?`🎯 ${data.lastDraw}`:'準備好了嗎？';$('#announceDrawBtn').classList.toggle('hidden',!isHost||!data.lastDraw);
  $('#lineOfficialBtn').href=cfg.lineOfficialUrl||'#';$('#lineFloat').href=cfg.lineOfficialUrl||'#';
  $$('#flowNav button').forEach(b=>{const step=b.dataset.step;if(!isHost)b.disabled=step!==phaseStep();else b.disabled=data.phase!=='setup'&&step==='setup'});
}
function showStep(name,force=false){if(!force&&!isHost&&name!==phaseStep())return;$$('.step').forEach(e=>e.classList.toggle('active',e.id===`${name}Step`));$$('#flowNav button').forEach(b=>b.classList.toggle('active',b.dataset.step===name));window.scrollTo({top:0,behavior:'smooth'})}
function roomState(){return {title:data.title,options:data.options,recent:data.recent,lastDraw:data.lastDraw,phase:data.phase}}
function send(payload){try{if(roomSocket?.readyState===1)roomSocket.send(JSON.stringify(payload))}catch{}}
function sync(){if(isHost&&data.phase==='setup')send({type:'state:set',state:roomState()})}
function applyState(s,myVote=null,hostFlag=null){if(!s)return;data.title=s.title||data.title;data.options=Array.isArray(s.options)?s.options:data.options;data.recent=Array.isArray(s.recent)?s.recent:data.recent;data.lastDraw=s.lastDraw||null;data.phase=s.phase||'setup';if(hostFlag!==null)isHost=!!hostFlag;data.myVote=myVote||null;selectedVote=data.myVote;if(selectedVote&&!data.options.some(o=>o.id===selectedVote))selectedVote=null;save();render();showStep(phaseStep(),true)}

async function createRoom(){
  const title=$('#roomTopicInput').value.trim()||'我的 Choice',password=$('#roomPasswordInput').value.trim();
  data={...blank,title,roomPassword:password};selectedVote=null;drawSelected.clear();
  try{const r=await fetch(api('/api/rooms'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password,state:roomState()})});const j=await r.json();if(!r.ok)throw new Error(j.error||'建立失敗');data.roomCode=j.code;data.hostToken=j.hostToken||'';isHost=true;save();$('#openRoomDialog').close();connectRoom();render();showStep('setup',true);toast(`房間 ${j.code} 已建立`)}catch(e){toast(e.message||'無法建立房間');throw e}
}
function connectRoom(){
  if(!data.roomCode)return;if(roomSocket)try{roomSocket.close()}catch{}
  const u=new URL(api(`/api/rooms/${data.roomCode}/ws`),location.href);u.searchParams.set('clientId',clientId);u.searchParams.set('name',data.displayName);if(data.roomPassword)u.searchParams.set('password',data.roomPassword);if(data.hostToken)u.searchParams.set('hostToken',data.hostToken);u.protocol=u.protocol==='https:'?'wss:':'ws:';
  try{roomSocket=new WebSocket(u);roomSocket.onopen=()=>send({type:'join'});roomSocket.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.type==='snapshot')applyState(m.state,m.myVote,m.isHost);if(m.type==='members'){roomMembers=m.members||[];render()}if(m.type==='announce')showAnnouncement(m.result);if(m.type==='draw'&&m.name){data.lastDraw=m.name;save();render();toast(`🎯 抽中 ${m.name}`)}if(m.type==='vote:ack'){const f=$('#stampFx');f.classList.remove('show');void f.offsetWidth;f.classList.add('show');toast('已投票 ✓')}if(m.type==='error')toast(m.message||'操作失敗')};roomSocket.onclose=e=>{roomMembers=[];render();if(e.code===4001){pendingJoinCode=data.roomCode;data.roomCode=null;data.roomPassword='';data.hostToken='';isHost=false;save();render();$('#joinDialog').showModal();toast('需要房間密碼')}}}catch{toast('連線失敗')}
}
function attemptJoin(code,password=''){code=String(code||'').trim().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(code))return toast('房間不存在');data.roomCode=code;data.roomPassword=password;data.hostToken='';isHost=false;pendingJoinCode=code;save();render();connectRoom()}
function leaveRoom(){try{roomSocket?.close()}catch{}roomSocket=null;roomMembers=[];data.roomCode=null;data.roomPassword='';data.hostToken='';data.myVote=null;isHost=false;selectedVote=null;save();history.replaceState({},'',location.pathname);render();showStep('setup',true);loadRoomList()}
async function shareRoom(){const u=new URL(location.href);u.searchParams.set('room',data.roomCode);try{if(navigator.share)await navigator.share({title:data.title,text:`加入 Choice：${data.roomCode}`,url:u.href});else{await navigator.clipboard.writeText(u.href);toast('邀請連結已複製')}}catch{}}

$('#openRoomBtn').onclick=()=>$('#openRoomDialog').showModal();
$('#roomList').onclick=e=>{const b=e.target.closest('[data-room-code]');if(b)attemptJoin(b.dataset.roomCode)};
$('#createRoomBtn').onclick=createRoom;
$('#joinWithPasswordBtn').onclick=()=>{const p=$('#joinPasswordInput').value;$('#joinDialog').close();attemptJoin(pendingJoinCode,p)};$('#shareRoomBtn').onclick=shareRoom;$('#leaveRoomBtn').onclick=leaveRoom;
$$('#flowNav button').forEach(b=>b.onclick=()=>showStep(b.dataset.step));

function addOption(){if(!isHost||data.phase!=='setup')return;const input=$('#optionInput'),name=input.value.trim();if(!name)return;if(data.options.length>=12)return toast('最多 12 個項目');if(data.options.some(o=>o.name===name))return toast('項目重複');const id=makeId();data.options.push({id,name,votes:0});drawSelected.add(id);input.value='';save();render();sync()}
$('#addOptionBtn').onclick=addOption;$('#optionInput').onkeydown=e=>{if(e.key==='Enter')addOption()};
$('#setupOptions').onclick=e=>{if(!isHost||data.phase!=='setup')return;const b=e.target.closest('[data-remove]');if(!b)return;data.options=data.options.filter(o=>o.id!==b.dataset.remove);drawSelected.delete(b.dataset.remove);save();render();sync()};
$('#goVoteBtn').onclick=()=>{if(data.options.length<2)return toast('至少要有 2 個項目');send({type:'phase',phase:'voting'})};$('#goDrawBtn').onclick=()=>{if(data.options.length<2)return toast('至少要有 2 個項目');send({type:'phase',phase:'draw'})};
$('#voteOptions').onclick=e=>{const b=e.target.closest('[data-vote]');if(!b||data.phase!=='voting')return;selectedVote=b.dataset.vote;render()};$('#voteBtn').onclick=()=>{if(!selectedVote||data.phase!=='voting')return;send({type:'vote',optionId:selectedVote})};$('#closeVoteBtn').onclick=()=>send({type:'phase',phase:'closed'});$('#analysisDrawBtn').onclick=()=>send({type:'phase',phase:'draw'});$('#announceVoteBtn').onclick=()=>{const t=topChoice();if(!t)return toast('目前沒有投票結果');announce(t.name)};
$('#drawChecks').onchange=e=>{if(!isHost)return;const c=e.target.closest('[data-draw]');if(!c)return;c.checked?drawSelected.add(c.dataset.draw):drawSelected.delete(c.dataset.draw)};
$('#throwBtn').onclick=()=>{if(!isHost||throwing)return;const ids=[...drawSelected].filter(id=>data.options.some(o=>o.id===id));if(ids.length<2)return toast('至少勾選 2 個項目');throwing=true;const dart=$('#dart');dart.classList.remove('fly');void dart.offsetWidth;dart.classList.add('fly');$('#drawResult').textContent='射鏢飛行中…';setTimeout(()=>{send({type:'draw:request',optionIds:ids});throwing=false},850)};
$('#announceDrawBtn').onclick=()=>{if(data.lastDraw)announce(data.lastDraw)};function announce(result){if(!isHost)return;send({type:'announce',result});showAnnouncement(result)}function showAnnouncement(result){$('#announceResult').textContent=result;$('#announceDialog').showModal()}

$('#lineFloat').onclick=e=>{if(!cfg.lineOfficialUrl){e.preventDefault();toast('官方 LINE 尚未設定')}};
$('#voiceBtn').onclick=()=>$('#voiceDialog').showModal();$('#micTestBtn').onclick=async()=>{try{if(micStream){stopMic();return}micStream=await navigator.mediaDevices.getUserMedia({audio:true});audioCtx=new AudioContext();const src=audioCtx.createMediaStreamSource(micStream);analyser=audioCtx.createAnalyser();src.connect(analyser);$('#micTestBtn').textContent='停止測試';meter()}catch{toast('無法取得麥克風權限')}};function meter(){if(!analyser)return;const a=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(a);$('#voiceMeterBar').style.width=`${Math.min(100,a.reduce((x,y)=>x+y,0)/a.length*1.4)}%`;meterRAF=requestAnimationFrame(meter)}function stopMic(){if(meterRAF)cancelAnimationFrame(meterRAF);micStream?.getTracks().forEach(t=>t.stop());audioCtx?.close();micStream=audioCtx=analyser=null;$('#voiceMeterBar').style.width='0';$('#micTestBtn').textContent='測試麥克風'}
$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());

const roomFromUrl=new URL(location.href).searchParams.get('room');if(roomFromUrl&&/^[A-Za-z0-9]{6}$/.test(roomFromUrl)){pendingJoinCode=roomFromUrl.toUpperCase();attemptJoin(pendingJoinCode)}else if(data.roomCode)connectRoom();render();loadRoomList();setInterval(()=>{if(!data.roomCode)loadRoomList()},8000);
