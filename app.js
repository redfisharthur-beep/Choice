const stateKey='choice-app-v1';
const palette=['#ffdce7','#dff4ec','#dcecff','#fff0c8','#eadfff','#dff6f8','#ffe5cf','#e2efd2'];
const emojis=['🍓','🍜','🍕','🍱','🥐','🌿','🐣','⭐'];
const makeId=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const defaultState={title:'今天晚餐吃什麼？',options:[{id:makeId(),name:'火鍋',votes:0},{id:makeId(),name:'燒肉',votes:0},{id:makeId(),name:'義大利麵',votes:0},{id:makeId(),name:'壽司',votes:0}],myVote:null,recent:[]};
let data=load();
let selectedId=data.myVote||null;
let throwing=false;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function load(){try{return {...defaultState,...JSON.parse(localStorage.getItem(stateKey)||'{}')}}catch{return structuredClone(defaultState)}}
function save(){localStorage.setItem(stateKey,JSON.stringify(data))}
function totalVotes(){return data.options.reduce((s,o)=>s+o.votes,0)}
function esc(v){return String(v).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]))}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),1800)}

function render(){
  $('#pollTitle').value=data.title;
  $('#pollTitleDisplay').textContent=data.title;
  const total=totalVotes();
  $('#voteCount').textContent=`${total} 票`;
  $('#analysisTotal').textContent=`${total} 票`;
  $('#optionsGrid').innerHTML=data.options.map((o,i)=>`<div class="option-card ${selectedId===o.id?'selected':''}" data-id="${o.id}"><div class="option-left"><span class="option-emoji">${emojis[i%emojis.length]}</span><div><div class="option-name">${esc(o.name)}</div><div class="option-votes">${o.votes} 票</div></div></div><button class="remove-option" data-remove="${o.id}" aria-label="刪除 ${esc(o.name)}">×</button></div>`).join('');
  $('#voteBtn').disabled=!selectedId||data.options.length<2;
  renderAnalysis();renderBoard();renderRecent();
}

function renderAnalysis(){
  const total=totalVotes();
  $('#chartList').innerHTML=data.options.length?data.options.map((o,i)=>{const p=total?Math.round(o.votes/total*100):0;return `<div class="bar-row"><div class="bar-label">${emojis[i%emojis.length]} ${esc(o.name)}</div><div class="bar-track"><div class="bar-fill" style="width:${p}%;background:linear-gradient(90deg,${palette[i%palette.length]},#84bff0)"></div></div><div class="bar-value">${p}%</div></div>`}).join(''):'<p class="hint centered">尚未建立選項</p>';
  const sorted=[...data.options].sort((a,b)=>b.votes-a.votes);
  let copy='目前尚未產生投票資料。你可以回到投票頁開始投票；如果不想投票，也可以直接切到射鏢抽籤，用同一組選項隨機決定。';
  if(total){const top=sorted[0];const tied=sorted.filter(o=>o.votes===top.votes);copy=tied.length>1?`目前有 ${tied.length} 個選項並列第一，都是 ${top.votes} 票。你可以直接採用投票結果，也可以另外使用射鏢抽籤作為隨機決定。`:`「${top.name}」暫時領先，共 ${top.votes} 票，占 ${Math.round(top.votes/total*100)}%。你可以直接採用投票結果；射鏢抽籤則是獨立的另一種玩法。`}
  $('#insightText').textContent=copy;
}

function renderBoard(){
  const board=$('#dartBoard');
  if(!data.options.length){board.innerHTML='<div class="board-core">?</div>';return}
  const n=data.options.length;
  const angle=360/n;
  const parts=data.options.map((o,i)=>{const a=i*angle;const hue=palette[i%palette.length];return `<div class="board-segment" style="background:${hue};transform:rotate(${a}deg) skewY(${90-angle}deg)"><span style="transform:skewY(${-(90-angle)}deg) rotate(${angle/2}deg);max-width:92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.name)}</span></div>`}).join('');
  board.innerHTML=parts+'<div class="board-core">🎯</div>';
}

function renderRecent(){
  $('#recentResults').innerHTML=(data.recent||[]).slice(0,5).map(v=>`<span class="recent-chip">🎯 ${esc(v)}</span>`).join('');
}

function switchView(name){
  $$('.mode-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===`${name}View`));
  window.scrollTo({top:Math.max(0,$('.mode-tabs').offsetTop-12),behavior:'smooth'});
}

$('#pollTitle').addEventListener('input',e=>{data.title=e.target.value.trim()||'未命名主題';save();$('#pollTitleDisplay').textContent=data.title});
$('#addOptionBtn').addEventListener('click',addOption);
$('#optionInput').addEventListener('keydown',e=>{if(e.key==='Enter')addOption()});
function addOption(){
  const input=$('#optionInput');const name=input.value.trim();
  if(!name)return toast('先輸入一個選項吧！');
  if(data.options.length>=8)return toast('第一版最多 8 個選項');
  if(data.options.some(o=>o.name===name))return toast('這個選項已經有了');
  data.options.push({id:makeId(),name,votes:0});input.value='';save();render();toast('已加入新選項 ✨');
}

$('#optionsGrid').addEventListener('click',e=>{
  const remove=e.target.closest('[data-remove]');
  if(remove){e.stopPropagation();const id=remove.dataset.remove;if(data.options.length<=2)return toast('至少保留 2 個選項');const old=data.options.find(o=>o.id===id);data.options=data.options.filter(o=>o.id!==id);if(data.myVote===id){data.myVote=null;selectedId=null;if(old&&old.votes>0)old.votes--}save();render();return}
  const card=e.target.closest('.option-card');if(!card)return;selectedId=card.dataset.id;render();
});

$('#voteBtn').addEventListener('click',()=>{
  if(!selectedId)return;
  if(data.myVote&&data.myVote!==selectedId){const prev=data.options.find(o=>o.id===data.myVote);if(prev&&prev.votes>0)prev.votes--}
  if(data.myVote!==selectedId){const current=data.options.find(o=>o.id===selectedId);if(current)current.votes++}
  data.myVote=selectedId;save();render();const fx=$('#stampFx');fx.classList.remove('show');void fx.offsetWidth;fx.classList.add('show');toast('投票完成！已蓋章 ✓');
});

$('#resetBtn').addEventListener('click',()=>{localStorage.removeItem(stateKey);data=structuredClone(defaultState);selectedId=null;save();render();toast('已重新開始')});
$$('.mode-tab').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));
$('.jump-roulette').addEventListener('click',()=>switchView('roulette'));

$('#throwBtn').addEventListener('click',()=>{
  if(throwing)return;
  if(data.options.length<2)return toast('至少需要 2 個選項');
  throwing=true;
  const pick=data.options[Math.floor(Math.random()*data.options.length)];
  const dart=$('#dart');
  const radius=31+Math.random()*18;
  const theta=Math.random()*Math.PI*2;
  const x=50+Math.cos(theta)*radius;
  const y=50+Math.sin(theta)*radius;
  dart.style.setProperty('--dart-x',`${x}%`);dart.style.setProperty('--dart-y',`${y}%`);
  dart.classList.remove('fly');void dart.offsetWidth;dart.classList.add('fly');
  $('#rouletteResult').textContent='射鏢飛行中…';$('#rouletteSub').textContent='會射中哪一個目標呢？';
  setTimeout(()=>{
    $('#rouletteResult').textContent=pick.name;
    $('#rouletteSub').textContent=`射中了「${pick.name}」！這次就由抽籤結果決定。`;
    data.recent=[pick.name,...(data.recent||[])].slice(0,5);save();renderRecent();throwing=false;
  },1000);
});

$('#voiceBtn').addEventListener('click',()=>$('#voiceDialog').showModal());
$('#lineLoginBtn').addEventListener('click',()=>$('#lineDialog').showModal());
$$('.dialog-close').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close()}));

render();