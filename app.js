const cfg=window.CHOICE_CONFIG||{apiBase:'',realtimeEnabled:false,lineOfficialUrl:''};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const makeId=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const clientId=localStorage.getItem('choice-client-id')||makeId();localStorage.setItem('choice-client-id',clientId);
const savedDisplayName=localStorage.getItem('choice-display-name')||'';
const stateKey='choice-app-v4';
const blank={title:'今晚吃什麼？',options:[],myVote:null,recent:[],roomCode:null,roomPassword:'',hostToken:'',displayName:savedDisplayName,lastDraw:null,phase:'setup'};
let data=load(),selectedVote=data.myVote||null,drawSelected=new Set(),roomSocket=null,roomMembers=[],throwing=false,pendingJoinCode='',pendingJoinLocked=false,micStream=null,audioCtx=null,analyser=null,meterRAF=null,isHost=false,leavingRoom=false;
let voiceStream=null,voiceJoined=false,voiceMuted=false;
const voicePeers=new Map(),pendingIce=new Map();
const rtcConfig={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
const persistName=name=>{const n=String(name||'').trim().slice(0,20);data.displayName=n;localStorage.setItem('choice-display-name',n);return n};
function load(){try{return {...blank,...JSON.parse(localStorage.getItem(stateKey)||'{}')}}catch{return {...blank}}}
function save(){localStorage.setItem(stateKey,JSON.stringify(data))}
function api(path){return `${cfg.apiBase||''}${path}`}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]))}
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('show'),1800)}
function totalVotes(){return data.options.reduce((a,o)=>a+(o.votes||0),0)}
function topChoice(){const s=[...data.options].sort((a,b)=>(b.votes||0)-(a.votes||0));return s[0]&&s[0].votes?s[0]:null}
function phaseStep(){return data.phase==='voting'?'vote':data.phase==='closed'?'analysis':data.phase==='draw'?'draw':'setup'}
async function readJsonResponse(r){const text=await r.text();if(!text)return {ok:false,error:`伺服器沒有回應（HTTP ${r.status}）`};try{return JSON.parse(text)}catch{return {ok:false,error:`伺服器回應格式錯誤（HTTP ${r.status}）`}}}

async function loadRoomList(){
  const list=$('#roomList');if(!list||data.roomCode)return;
  try{const r=await fetch(api('/api/rooms'),{cache:'no-store'}),j=await readJsonResponse(r);if(!r.ok)throw new Error(j.error||'讀取失敗');const rooms=Array.isArray(j.rooms)?j.rooms:[];list.innerHTML=rooms.map(room=>`<button class="room-list-item" type="button" data-room-code="${esc(room.code)}" data-locked="${room.locked?'1':'0'}"><span class="room-list-name">${esc(room.title||'未命名房間')}</span><span class="room-list-meta">${room.locked?'🔒':'進入'}</span></button>`).join('')}catch{list.innerHTML=''}
}

function renderPlayers(){
  const list=$('#playerList'),status=$('#voteProgressText');if(!list||!status)return;
  let members=roomMembers;
  if(data.roomCode&&!members.length&&data.displayName)members=[{clientId,name:data.displayName,isHost,voted:!!data.myVote,voice:voiceJoined}];
  const voted=members.filter(m=>m.voted).length;
  status.textContent=data.phase==='voting'?`${voted}/${members.length} 已投票`:`${members.length} 人在線`;
  list.innerHTML=members.map(m=>`<div class="player-chip ${m.isHost?'host':''}"><span class="player-name">${m.isHost?'★ ':''}${esc(m.name||'訪客')}${m.voice?' 🎙️':''}</span><span class="player-vote-state ${m.voted?'done':''}">${data.phase==='voting'?(m.voted?'✓ 已投':'等待'):(m.voice?'語音中':'在線')}</span></div>`).join('');
}

function updateVoiceUi(){
  const join=$('#joinVoiceBtn'),mute=$('#muteVoiceBtn'),leave=$('#leaveVoiceBtn'),status=$('#voiceStatus');if(!join||!mute||!leave||!status)return;
  const onlineVoice=roomMembers.filter(m=>m.voice).length;
  join.disabled=!data.roomCode||roomSocket?.readyState!==1||voiceJoined;
  join.classList.toggle('hidden',voiceJoined);
  mute.classList.toggle('hidden',!voiceJoined);leave.classList.toggle('hidden',!voiceJoined);
  mute.textContent=voiceMuted?'解除靜音':'靜音';
  status.textContent=!data.roomCode?'先進入房間':voiceJoined?`${Math.max(1,onlineVoice)} 人在語音`:'可加入房間語音';
}

function render(){
  $('#homeView').classList.toggle('hidden',!!data.roomCode);$('#roomView').classList.toggle('hidden',!data.roomCode);
  $('#roomTitle').textContent=data.title||'我的 Choice';$('#roomCodeText').textContent=data.roomCode||'——';$('#participantCount').textContent=`${Math.max(1,roomMembers.length)} 人`;
  $('#roleBadge').textContent=isHost?'房主':'參與者';$('#roleBadge').classList.toggle('host',isHost);
  renderPlayers();updateVoiceUi();
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
function clearRoomState(){stopVoice(false);roomMembers=[];data.roomCode=null;data.roomPassword='';data.hostToken='';data.myVote=null;isHost=false;selectedVote=null;pendingJoinCode='';pendingJoinLocked=false;save();history.replaceState({},'',location.pathname);render();showStep('setup',true);setTimeout(loadRoomList,120)}

function openJoinDialog(code,locked=true){pendingJoinCode=String(code||'').toUpperCase();pendingJoinLocked=!!locked;$('#joinNameInput').value=data.displayName||localStorage.getItem('choice-display-name')||'';$('#joinPasswordInput').value='';$('#joinPasswordLabel').classList.toggle('hidden',!pendingJoinLocked);$('#joinDialog').showModal();setTimeout(()=>$('#joinNameInput').focus(),40)}

async function createRoom(){
  const name=persistName($('#hostNameInput').value),title=$('#roomTopicInput').value.trim()||'我的 Choice',password=$('#roomPasswordInput').value.trim();if(!name)return toast('請輸入名稱');
  data={...blank,title,roomPassword:password,displayName:name};selectedVote=null;drawSelected.clear();
  try{const r=await fetch(api('/api/rooms'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password,state:roomState()})});const j=await readJsonResponse(r);if(!r.ok||!j.code)throw new Error(j.error||`建立失敗（HTTP ${r.status}）`);data.roomCode=j.code;data.hostToken=j.hostToken||'';isHost=true;save();$('#openRoomDialog').close();connectRoom();render();showStep('setup',true);toast(`房間 ${j.code} 已建立`)}catch(e){toast(e.message||'無法建立房間');throw e}
}
function connectRoom(){
  if(!data.roomCode)return;if(roomSocket)try{roomSocket.close()}catch{}
  const u=new URL(api(`/api/rooms/${data.roomCode}/ws`),location.href);u.searchParams.set('clientId',clientId);u.searchParams.set('name',data.displayName||'訪客');if(data.roomPassword)u.searchParams.set('password',data.roomPassword);if(data.hostToken)u.searchParams.set('hostToken',data.hostToken);u.protocol=u.protocol==='https:'?'wss:':'ws:';
  try{
    roomSocket=new WebSocket(u);
    roomSocket.onopen=()=>{send({type:'join'});render()};
    roomSocket.onmessage=async e=>{
      let m;try{m=JSON.parse(e.data)}catch{return}
      if(m.type==='snapshot')applyState(m.state,m.myVote,m.isHost);
      if(m.type==='members'){roomMembers=m.members||[];const activeVoice=new Set(roomMembers.filter(x=>x.voice).map(x=>x.clientId));for(const id of [...voicePeers.keys()])if(!activeVoice.has(id))closeVoicePeer(id);render()}
      if(m.type==='voice:peers'&&voiceJoined){for(const peer of m.peers||[])await ensureVoicePeer(peer.clientId,true)}
      if(m.type==='voice:signal'&&voiceJoined)await handleVoiceSignal(m.from,m.data);
      if(m.type==='voice:left')closeVoicePeer(m.clientId);
      if(m.type==='announce')showAnnouncement(m.result);
      if(m.type==='draw'&&m.name){data.lastDraw=m.name;save();render();toast(`🎯 抽中 ${m.name}`)}
      if(m.type==='vote:ack'){const f=$('#stampFx');f.classList.remove('show');void f.offsetWidth;f.classList.add('show');toast('已投票 ✓')}
      if(m.type==='room:closed'){toast('房主已關閉房間');clearRoomState()}
      if(m.type==='error')toast(m.message||'操作失敗');
    };
    roomSocket.onclose=e=>{roomMembers=[];stopVoice(false);render();if(leavingRoom){leavingRoom=false;return}if(e.code===4001){const code=data.roomCode;data.roomCode=null;data.roomPassword='';data.hostToken='';isHost=false;save();render();openJoinDialog(code,true);toast('請輸入房間密碼');return}if(e.code===4004||e.code===4005){clearRoomState();if(e.code===4004)toast('房間不存在或已失效');return}};
  }catch{toast('連線失敗')}
}
function attemptJoin(code,password='',name=''){code=String(code||'').trim().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(code))return toast('房間不存在');const displayName=persistName(name||data.displayName);if(!displayName)return toast('請輸入名稱');data.roomCode=code;data.roomPassword=password;data.hostToken='';data.displayName=displayName;isHost=false;pendingJoinCode=code;save();render();connectRoom()}
function leaveRoom(){const wasHost=isHost;stopVoice(true);leavingRoom=true;if(wasHost&&roomSocket?.readyState===1){send({type:'room:close'});setTimeout(()=>{try{roomSocket?.close()}catch{}roomSocket=null;clearRoomState()},120)}else{try{roomSocket?.close()}catch{}roomSocket=null;clearRoomState()}}
async function shareRoom(){const u=new URL(location.href);u.searchParams.set('room',data.roomCode);try{if(navigator.share)await navigator.share({title:data.title,text:`加入 Choice：${data.roomCode}`,url:u.href});else{await navigator.clipboard.writeText(u.href);toast('邀請連結已複製')}}catch{}}

async function ensureVoicePeer(peerId,offerer=false){
  if(!peerId||peerId===clientId||!voiceStream)return null;
  if(voicePeers.has(peerId))return voicePeers.get(peerId);
  const pc=new RTCPeerConnection(rtcConfig);voicePeers.set(peerId,pc);
  voiceStream.getTracks().forEach(track=>pc.addTrack(track,voiceStream));
  pc.onicecandidate=e=>{if(e.candidate)send({type:'voice:signal',to:peerId,data:{candidate:e.candidate}})};
  pc.ontrack=e=>{let audio=document.getElementById(`voice-audio-${peerId}`);if(!audio){audio=document.createElement('audio');audio.id=`voice-audio-${peerId}`;audio.autoplay=true;audio.playsInline=true;$('#voiceAudioRack').appendChild(audio)}audio.srcObject=e.streams[0];audio.play().catch(()=>{})};
  pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(pc.connectionState))closeVoicePeer(peerId)};
  if(offerer){const offer=await pc.createOffer();await pc.setLocalDescription(offer);send({type:'voice:signal',to:peerId,data:{description:pc.localDescription}})}
  return pc;
}
async function flushIce(peerId,pc){const list=pendingIce.get(peerId)||[];pendingIce.delete(peerId);for(const c of list)try{await pc.addIceCandidate(c)}catch{}}
async function handleVoiceSignal(from,payload){
  if(!from||!payload)return;const pc=await ensureVoicePeer(from,false);if(!pc)return;
  try{
    if(payload.description){await pc.setRemoteDescription(payload.description);await flushIce(from,pc);if(payload.description.type==='offer'){const answer=await pc.createAnswer();await pc.setLocalDescription(answer);send({type:'voice:signal',to:from,data:{description:pc.localDescription}})}}
    if(payload.candidate){if(pc.remoteDescription)await pc.addIceCandidate(payload.candidate);else{const list=pendingIce.get(from)||[];list.push(payload.candidate);pendingIce.set(from,list)}}
  }catch(err){console.warn('voice signal error',err)}
}
function closeVoicePeer(peerId){const pc=voicePeers.get(peerId);if(pc)try{pc.close()}catch{}voicePeers.delete(peerId);pendingIce.delete(peerId);document.getElementById(`voice-audio-${peerId}`)?.remove()}
function startMeter(stream){stopMeter();try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();const src=audioCtx.createMediaStreamSource(stream);analyser=audioCtx.createAnalyser();src.connect(analyser);const tick=()=>{if(!analyser)return;const a=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(a);const avg=a.reduce((x,y)=>x+y,0)/Math.max(1,a.length);$('#voiceMeterBar').style.width=`${Math.min(100,avg*1.6)}%`;meterRAF=requestAnimationFrame(tick)};tick()}catch{}}
function stopMeter(){if(meterRAF)cancelAnimationFrame(meterRAF);meterRAF=null;analyser=null;if(audioCtx)audioCtx.close().catch(()=>{});audioCtx=null;const bar=$('#voiceMeterBar');if(bar)bar.style.width='0'}
async function joinVoice(){
  if(!data.roomCode||roomSocket?.readyState!==1)return toast('請先進入房間');if(voiceJoined)return;
  try{if(micStream)stopMicTest();voiceStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});voiceJoined=true;voiceMuted=false;startMeter(voiceStream);send({type:'voice:join'});render();toast('已加入語音')}
  catch{toast('無法取得麥克風權限')}
}
function toggleVoiceMute(){if(!voiceJoined||!voiceStream)return;voiceMuted=!voiceMuted;voiceStream.getAudioTracks().forEach(t=>t.enabled=!voiceMuted);render();toast(voiceMuted?'已靜音':'已解除靜音')}
function stopVoice(notify=true){if(!voiceJoined&&!voiceStream)return;if(notify)send({type:'voice:leave'});for(const id of [...voicePeers.keys()])closeVoicePeer(id);voiceStream?.getTracks().forEach(t=>t.stop());voiceStream=null;voiceJoined=false;voiceMuted=false;stopMeter();render()}
async function toggleMicTest(){if(voiceJoined)return toast('已在房間語音中');try{if(micStream){stopMicTest();return}micStream=await navigator.mediaDevices.getUserMedia({audio:true});startMeter(micStream);$('#micTestBtn').textContent='停止測試'}catch{toast('無法取得麥克風權限')}}
function stopMicTest(){micStream?.getTracks().forEach(t=>t.stop());micStream=null;stopMeter();$('#micTestBtn').textContent='測試麥克風'}

$('#openRoomBtn').onclick=()=>{$('#hostNameInput').value=data.displayName||localStorage.getItem('choice-display-name')||'';$('#openRoomDialog').showModal()};
$('#roomList').onclick=e=>{const b=e.target.closest('[data-room-code]');if(b)openJoinDialog(b.dataset.roomCode,b.dataset.locked==='1')};
$('#createRoomBtn').onclick=createRoom;
$('#joinWithPasswordBtn').onclick=()=>{const name=$('#joinNameInput').value.trim(),p=pendingJoinLocked?$('#joinPasswordInput').value:'';if(!name)return toast('請輸入名稱');$('#joinDialog').close();attemptJoin(pendingJoinCode,p,name)};$('#shareRoomBtn').onclick=shareRoom;$('#leaveRoomBtn').onclick=leaveRoom;
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
$('#voiceBtn').onclick=()=>{updateVoiceUi();$('#voiceDialog').showModal()};$('#micTestBtn').onclick=toggleMicTest;$('#joinVoiceBtn').onclick=joinVoice;$('#muteVoiceBtn').onclick=toggleVoiceMute;$('#leaveVoiceBtn').onclick=()=>stopVoice(true);
$$('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());

const roomFromUrl=new URL(location.href).searchParams.get('room');if(roomFromUrl&&/^[A-Za-z0-9]{6}$/.test(roomFromUrl)){openJoinDialog(roomFromUrl.toUpperCase(),true)}else if(data.roomCode&&data.displayName)connectRoom();render();loadRoomList();setInterval(()=>{if(!data.roomCode)loadRoomList()},5000);
