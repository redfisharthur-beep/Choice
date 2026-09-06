const cfg=window.CHOICE_CONFIG||{apiBase:'',realtimeEnabled:false,lineEnabled:false};
const stateKey='choice-app-v2';
const clientKey='choice-client-id';
const palette=['#ffdce7','#dff4ec','#dcecff','#fff0c8','#eadfff','#dff6f8','#ffe5cf','#e2efd2'];
const emojis=['🍓','🍜','🍕','🍱','🥐','🌿','🐣','⭐'];
const makeId=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const clientId=localStorage.getItem(clientKey)||makeId();localStorage.setItem(clientKey,clientId);
const defaultState={title:'今天晚餐吃什麼？',options:[{id:makeId(),name:'火鍋',votes:0},{id:makeId(),name:'燒肉',votes:0},{id:makeId(),name:'義大利麵',votes:0},{id:makeId(),name:'壽司',votes:0}],myVote:null,recent:[],roomCode:null,displayName:'訪客'};
let data=load(),selectedId=data.myVote||null,throwing=false,roomSocket=null,roomMembers=[],syncTimer=null,micStream=null,audioCtx=null,analyser=null,meterRAF=null;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];

function load(){try{return {...structuredClone(defaultState),...JSON.parse(localStorage.getItem(stateKey)||'{}')}}catch{return structuredClone(defaultState)}}
function save(){localStorage.setItem(stateKey,JSON.stringify(data))}
function esc(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function totalVotes(){return data.options.reduce((s,o)=>s+(o.votes||0),0)}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),1900)}
function api(path){return `${cfg.apiBase||''}${path}`}

function render(){
  $('#pollTitle').value=data.title;$('#pollTitleDisplay').textContent=data.title;
  const total=totalVotes();$('#voteCount').textContent=`${total} 票`;$('#analysisTotal').textContent=`${total} 票`;
  $('#optionsGrid').innerHTML=data.options.map((o,i)=>`<div class="option-card ${selectedId===o.id?'selected':''}" data-id="${o.id}"><div class="option-left"><span class="option-emoji">${emojis[i%emojis.length]}</span><div><div class="option-name">${esc(o.name)}</div><div class="option-votes">${o.votes||0} 票</div></div></div><button class="remove-option" data-remove="${o.id}" aria-label="刪除 ${esc(o.name)}">×</button></div>`).join('');
  $('#voteBtn').disabled=!selectedId||data.options.length<2;renderAnalysis();renderBoard();renderRecent();renderRoom();
}
function renderAnalysis(){
  const total=totalVotes();
  $('#chartList').innerHTML=data.options.length?data.options.map((o,i)=>{const p=total?Math.round((o.votes||0)/total*100):0;return `<div class="bar-row"><div class="bar-label">${emojis[i%emojis.length]} ${esc(o.name)}</div><div class="bar-track"><div class="bar-fill" style="width:${p}%;background:linear-gradient(90deg,${palette[i%palette.length]},#84bff0)"></div></div><div class="bar-value">${p}%</div></div>`}).join(''):'<p class="hint centered">尚未建立選項</p>';
  const sorted=[...data.options].sort((a,b)=>(b.votes||0)-(a.votes||0));let copy='目前還沒有投票。你可以直接使用射鏢抽籤，不必先投票。';
  if(total){const top=sorted[0],tied=sorted.filter(o=>(o.votes||0)===(top.votes||0));copy=tied.length>1?`目前有 ${tied.length} 個選項並列第一，都是 ${top.votes} 票。可以直接採用投票結果，也可另外使用射鏢抽籤。`:`「${top.name}」目前領先，共 ${top.votes} 票，占 ${Math.round(top.votes/total*100)}%。`}
  $('#insightText').textContent=copy;
}
function renderBoard(){
  const board=$('#dartBoard');if(!data.options.length){board.innerHTML='<div class="board-core">?</div>';return}
  const n=data.options.length,angle=360/n;
  board.innerHTML=data.options.map((o,i)=>`<div class="board-segment" style="background:${palette[i%palette.length]};transform:rotate(${i*angle}deg) skewY(${90-angle}deg)"><span style="transform:skewY(${-(90-angle)}deg) rotate(${angle/2}deg);max-width:92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.name)}</span></div>`).join('')+'<div class="board-core">🎯</div>';
}
function renderRecent(){$('#recentResults').innerHTML=(data.recent||[]).slice(0,5).map(v=>`<span class="recent-chip">🎯 ${esc(v)}</span>`).join('')}
function renderRoom(){
  const joined=!!data.roomCode;$('#roomCodeText').textContent=data.roomCode||'—';$('#roomInfo').classList.toggle('hidden',!joined);$('#shareRoomBtn').classList.toggle('hidden',!joined);$('#leaveRoomBtn').classList.toggle('hidden',!joined);$('#createRoomQuickBtn').classList.toggle('hidden',joined);
  $('#roomStatusText').textContent=joined?(roomSocket?.readyState===1?'房間已連線':'房間連線中…'):'單機模式';$('#connectionDot').className=`connection-dot ${joined&&roomSocket?.readyState===1?'online':'offline'}`;$('#participantCount').textContent=`${Math.max(1,roomMembers.length)} 人在線`;
  $('#participantList').innerHTML=roomMembers.length?roomMembers.map(m=>`<span class="participant-chip">🙂 ${esc(m.name||'訪客')}</span>`).join(''):joined?'<span class="participant-chip">🙂 你</span>':'';
  $('#joinVoiceBtn').disabled=!joined||!cfg.realtimeEnabled;
}
function switchView(name){$$('.mode-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===name));$$('.view').forEach(v=>v.classList.toggle('active',v.id===`${name}View`));window.scrollTo({top:Math.max(0,$('.mode-tabs').offsetTop-12),behavior:'smooth'})}

function queueSync(){if(!data.roomCode||!roomSocket||roomSocket.readyState!==1)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>sendRoom({type:'state:set',state:{title:data.title,options:data.options,recent:data.recent}}),120)}
function sendRoom(payload){try{roomSocket?.send(JSON.stringify(payload))}catch{}}
function applyRoomState(s){if(!s)return;data.title=s.title||data.title;data.options=Array.isArray(s.options)?s.options:data.options;data.recent=Array.isArray(s.recent)?s.recent:data.recent;if(selectedId&&!data.options.some(o=>o.id===selectedId))selectedId=null;save();render()}

async function createRoom(){
  try{const r=await fetch(api('/api/rooms'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:data.displayName,state:{title:data.title,options:data.options,recent:data.recent}})});if(!r.ok)throw 0;const j=await r.json();data.roomCode=j.code;save();connectRoom();$('#roomDialog').close();toast(`房間 ${j.code} 已建立`)}catch{toast('Cloudflare 即時服務尚未連結')}
}
async function joinRoom(code){
  code=(code||'').trim().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(code))return toast('請輸入 6 位房號');data.roomCode=code;save();connectRoom();$('#roomDialog').close();
}
function connectRoom(){
  if(!data.roomCode)return;if(roomSocket)try{roomSocket.close()}catch{}
  const base=api(`/api/rooms/${data.roomCode}/ws?clientId=${encodeURIComponent(clientId)}&name=${encodeURIComponent(data.displayName)}`);const wsUrl=new URL(base,location.href);wsUrl.protocol=wsUrl.protocol==='https:'?'wss:':'ws:';
  try{roomSocket=new WebSocket(wsUrl);roomSocket.onopen=()=>{sendRoom({type:'join'});renderRoom();toast(`已加入房間 ${data.roomCode}`)};roomSocket.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}if(m.type==='snapshot')applyRoomState(m.state);if(m.type==='members'){roomMembers=m.members||[];renderRoom()}if(m.type==='draw'&&m.name){data.recent=[m.name,...(data.recent||[])].slice(0,5);save();renderRecent();toast(`🎯 ${m.by||'有人'} 射中了 ${m.name}`)}};roomSocket.onclose=()=>{roomMembers=[];renderRoom()};roomSocket.onerror=()=>renderRoom()}catch{renderRoom()}
}
function leaveRoom(){if(roomSocket)roomSocket.close();roomSocket=null;roomMembers=[];data.roomCode=null;save();history.replaceState({},'',location.pathname);renderRoom();toast('已離開多人房間')}
async function shareRoom(){const url=new URL(location.href);url.searchParams.set('room',data.roomCode);const text=`加入我的 Choice 房間：${data.roomCode}`;try{if(navigator.share)await navigator.share({title:'Choice 多人房間',text,url:url.href});else{await navigator.clipboard.writeText(url.href);toast('邀請連結已複製')}}catch{}}

$('#pollTitle').addEventListener('input',e=>{data.title=e.target.value.trim()||'未命名主題';save();$('#pollTitleDisplay').textContent=data.title;queueSync()});
$('#addOptionBtn').addEventListener('click',addOption);$('#optionInput').addEventListener('keydown',e=>{if(e.key==='Enter')addOption()});
function addOption(){const input=$('#optionInput'),name=input.value.trim();if(!name)return toast('先輸入一個選項吧！');if(data.options.length>=12)return toast('最多 12 個選項');if(data.options.some(o=>o.name===name))return toast('這個選項已經有了');data.options.push({id:makeId(),name,votes:0});input.value='';save();render();queueSync();toast('已加入新選項 ✨')}
$('#optionsGrid').addEventListener('click',e=>{const remove=e.target.closest('[data-remove]');if(remove){e.stopPropagation();const id=remove.dataset.remove;if(data.options.length<=2)return toast('至少保留 2 個選項');data.options=data.options.filter(o=>o.id!==id);if(data.myVote===id)data.myVote=null;if(selectedId===id)selectedId=null;save();render();queueSync();return}const card=e.target.closest('.option-card');if(card){selectedId=card.dataset.id;render()}});
$('#voteBtn').addEventListener('click',()=>{if(!selectedId)return;if(data.myVote&&data.myVote!==selectedId){const prev=data.options.find(o=>o.id===data.myVote);if(prev&&prev.votes>0)prev.votes--}if(data.myVote!==selectedId){const current=data.options.find(o=>o.id===selectedId);if(current)current.votes=(current.votes||0)+1}data.myVote=selectedId;save();render();queueSync();const fx=$('#stampFx');fx.classList.remove('show');void fx.offsetWidth;fx.classList.add('show');toast('投票完成！已蓋章 ✓')});
$('#resetBtn').addEventListener('click',()=>{const room=data.roomCode;data=structuredClone(defaultState);data.roomCode=room;selectedId=null;save();render();queueSync();toast('已重新開始')});
$$('.mode-tab').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));$('.jump-roulette').addEventListener('click',()=>switchView('roulette'));
$('#throwBtn').addEventListener('click',()=>{if(throwing)return;if(data.options.length<2)return toast('至少需要 2 個選項');throwing=true;const pick=data.options[Math.floor(Math.random()*data.options.length)],dart=$('#dart'),radius=31+Math.random()*18,theta=Math.random()*Math.PI*2;dart.style.setProperty('--dart-x',`${50+Math.cos(theta)*radius}%`);dart.style.setProperty('--dart-y',`${50+Math.sin(theta)*radius}%`);dart.classList.remove('fly');void dart.offsetWidth;dart.classList.add('fly');$('#rouletteResult').textContent='射鏢飛行中…';$('#rouletteSub').textContent='會射中哪一個目標呢？';setTimeout(()=>{$('#rouletteResult').textContent=pick.name;$('#rouletteSub').textContent=`射中了「${pick.name}」！`;data.recent=[pick.name,...(data.recent||[])].slice(0,5);save();renderRecent();sendRoom({type:'draw',name:pick.name});queueSync();throwing=false},1000)});

$('#roomBtn').addEventListener('click',()=>$('#roomDialog').showModal());$('#createRoomQuickBtn').addEventListener('click',createRoom);$('#createRoomBtn').addEventListener('click',createRoom);$('#joinRoomBtn').addEventListener('click',()=>joinRoom($('#joinRoomInput').value));$('#joinRoomInput').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom(e.target.value)});$('#shareRoomBtn').addEventListener('click',shareRoom);$('#leaveRoomBtn').addEventListener('click',leaveRoom);
$('#voiceBtn').addEventListener('click',()=>$('#voiceDialog').showModal());
$('#micTestBtn').addEventListener('click',async()=>{try{if(micStream){stopMic();return}micStream=await navigator.mediaDevices.getUserMedia({audio:true});audioCtx=new AudioContext();const src=audioCtx.createMediaStreamSource(micStream);analyser=audioCtx.createAnalyser();analyser.fftSize=256;src.connect(analyser);$('#micTestBtn').textContent='停止測試';$('#voiceStatus span').textContent='麥克風正常，說話時音量條會移動';meter()}catch{$('#voiceStatus span').textContent='無法取得麥克風權限，請檢查瀏覽器設定'}});
function meter(){if(!analyser)return;const arr=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(arr);const avg=arr.reduce((a,b)=>a+b,0)/arr.length;$('#voiceMeterBar').style.width=`${Math.min(100,avg*1.35)}%`;meterRAF=requestAnimationFrame(meter)}
function stopMic(){if(meterRAF)cancelAnimationFrame(meterRAF);micStream?.getTracks().forEach(t=>t.stop());audioCtx?.close();micStream=audioCtx=analyser=null;$('#voiceMeterBar').style.width='0%';$('#micTestBtn').textContent='測試麥克風';$('#voiceStatus span').textContent='尚未啟用麥克風'}
$('#joinVoiceBtn').addEventListener('click',()=>toast(cfg.realtimeEnabled?'正在進入語音…':'Cloudflare Realtime 尚未綁定'));
$('#lineLoginBtn').addEventListener('click',()=>$('#lineDialog').showModal());$('#startLineLoginBtn').addEventListener('click',()=>{if(!cfg.lineEnabled)return toast('LINE Login 尚未綁定');location.href=api('/api/auth/line/start')});
$$('.dialog-close').forEach(b=>b.addEventListener('click',()=>{const d=b.closest('dialog');if(d.id==='voiceDialog')stopMic();d.close()}));$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){if(d.id==='voiceDialog')stopMic();d.close()}}));

const roomFromUrl=new URL(location.href).searchParams.get('room');if(roomFromUrl&&/^[A-Za-z0-9]{6}$/.test(roomFromUrl)){data.roomCode=roomFromUrl.toUpperCase();save()}if(data.roomCode)connectRoom();render();