(()=>{
  const input=document.querySelector('#hostNameInput');
  const lineBtn=document.querySelector('#lineLoginBtn');
  const openRoomBtn=document.querySelector('#openRoomBtn');
  const toastEl=document.querySelector('#toast');
  const roomList=document.querySelector('#roomList');
  let lineUser=null;

  const showToast=text=>{if(!toastEl)return;toastEl.textContent=text;toastEl.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toastEl.classList.remove('show'),2200)};
  const syncName=value=>{
    const name=String(value||'').trim().slice(0,20);
    localStorage.setItem('choice-display-name',name);
    try{if(typeof data!=='undefined')data.displayName=name}catch{}
    try{const key='choice-app-v4',saved=JSON.parse(localStorage.getItem(key)||'{}');saved.displayName=name;localStorage.setItem(key,JSON.stringify(saved))}catch{}
    return name;
  };
  const setLineUi=user=>{
    lineUser=user||null;if(!lineBtn)return;
    lineBtn.classList.toggle('line-authenticated',!!lineUser);
    lineBtn.title=lineUser?`已使用 LINE 登入：${lineUser.displayName}`:'LINE 登入';
    lineBtn.setAttribute('aria-label',lineBtn.title);
    if(lineUser){localStorage.setItem('choice-line-user-id',lineUser.userId||'');localStorage.setItem('choice-line-picture',lineUser.pictureUrl||'')}
    else{localStorage.removeItem('choice-line-user-id');localStorage.removeItem('choice-line-picture')}
  };
  const loadSession=async()=>{try{const r=await fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'}),j=await r.json();if(j.authenticated&&j.user){setLineUi(j.user);if(input){input.value=j.user.displayName||input.value;syncName(input.value)}}else setLineUi(null)}catch{setLineUi(null)}};

  const currentVoteFlow=()=>{try{if(typeof data==='undefined'||!data?.roomCode)return {room:false,host:false,phase:'setup',tie:false};const options=Array.isArray(data.options)?data.options:[],max=options.reduce((m,o)=>Math.max(m,Math.max(0,Number(o?.votes)||0)),0),tie=max>0&&options.filter(o=>(Number(o?.votes)||0)===max).length>1;return {room:true,host:typeof isHost!=='undefined'&&!!isHost,phase:String(data.phase||'setup'),tie}}catch{return {room:false,host:false,phase:'setup',tie:false}}};
  const applyFlowRules=()=>{
    const flow=currentVoteFlow(),nav=document.querySelector('#flowNav');if(!nav)return;
    const setup=nav.querySelector('[data-step="setup"]'),vote=nav.querySelector('[data-step="vote"]'),draw=nav.querySelector('[data-step="draw"]');
    if(!flow.room||!flow.host){[setup,vote,draw].forEach(b=>{if(b)b.disabled=true});return}
    if(flow.phase==='setup'){if(setup)setup.disabled=false;if(vote)vote.disabled=true;if(draw)draw.disabled=true;return}
    if(flow.phase==='voting'){if(setup)setup.disabled=true;if(vote)vote.disabled=false;if(draw)draw.disabled=true;return}
    if(flow.phase==='closed'){if(setup)setup.disabled=true;if(vote)vote.disabled=false;if(draw)draw.disabled=!flow.tie;return}
    if(flow.phase==='draw'){if(setup)setup.disabled=true;if(vote)vote.disabled=true;if(draw)draw.disabled=false}
  };
  document.addEventListener('click',e=>{const target=e.target.closest?.('#flowNav button');if(!target)return;const flow=currentVoteFlow();if(!flow.room||!flow.host)return;let blocked=false;if(flow.phase==='voting'&&target.dataset?.step!=='vote')blocked=true;else if(target.dataset?.step==='draw'&&flow.phase==='closed'&&!flow.tie)blocked=true;if(blocked){e.preventDefault();e.stopImmediatePropagation();showToast(flow.phase==='voting'?'需等待投票截止，系統會自動結算':'只有最高票平分時才能抽籤')}},true);

  if(input){const saved=localStorage.getItem('choice-display-name')||'';if(!input.value)input.value=saved;input.addEventListener('input',()=>syncName(input.value));input.addEventListener('change',()=>syncName(input.value))}
  if(openRoomBtn){const original=openRoomBtn.onclick;openRoomBtn.onclick=e=>{const name=syncName(input?.value||'');if(!name){showToast('請先輸入名字');input?.focus();return}if(typeof original==='function')return original.call(openRoomBtn,e)}}
  if(lineBtn)lineBtn.onclick=async()=>{if(lineUser){showToast(`已使用 LINE 登入：${lineUser.displayName}`);return}try{const r=await fetch('/api/auth/line/status',{cache:'no-store',credentials:'same-origin'}),j=await r.json();if(!j.configured){showToast('LINE Login 尚未完成後台設定');return}location.assign('/api/auth/line/start')}catch{showToast('LINE Login 目前無法連線')}};

  if(roomList){
    const searchWrap=document.createElement('div');searchWrap.className='room-search';searchWrap.innerHTML='<button id="roomSearchToggle" class="room-search-toggle" type="button" aria-label="搜尋房間" title="搜尋房間"><img src="./assets/hero/search.png" alt="搜尋"></button><input id="roomSearchInput" class="room-search-input" type="search" maxlength="40" placeholder="輸入房間關鍵字" aria-label="輸入房間關鍵字">';roomList.before(searchWrap);
    const searchToggle=searchWrap.querySelector('#roomSearchToggle'),searchInput=searchWrap.querySelector('#roomSearchInput');
    const applyRoomFilter=()=>{const q=String(searchInput?.value||'').trim().toLowerCase();roomList.querySelectorAll('[data-room-code]').forEach(card=>{const title=String(card.querySelector('.room-list-name')?.textContent||'').trim().toLowerCase(),code=String(card.dataset.roomCode||'').trim().toLowerCase(),match=!q||title.includes(q)||code.includes(q);if(match){card.style.removeProperty('display');card.removeAttribute('aria-hidden')}else{card.style.setProperty('display','none','important');card.setAttribute('aria-hidden','true')}})};
    searchToggle?.addEventListener('click',()=>{const open=searchWrap.classList.toggle('open');if(open)setTimeout(()=>searchInput?.focus(),40);else if(searchInput){searchInput.value='';applyRoomFilter()}});['input','search','compositionend','keyup'].forEach(type=>searchInput?.addEventListener(type,applyRoomFilter));searchInput?.addEventListener('keydown',e=>{if(e.key==='Escape'){searchInput.value='';searchWrap.classList.remove('open');applyRoomFilter();searchInput.blur()}});new MutationObserver(()=>queueMicrotask(applyRoomFilter)).observe(roomList,{childList:true,subtree:true});
  }

  const pad=n=>String(n).padStart(2,'0');
  const sameDate=(a,b)=>a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  function ensureMorandiStyles(){
    if(document.querySelector('#morandiPickerStyles'))return;
    const style=document.createElement('style');style.id='morandiPickerStyles';style.textContent=`
      #voteDeadlineInput{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important;overflow:hidden!important}
      .morandi-deadline-btn,.morandi-option-date-btn{width:100%;min-height:58px;border:1px solid rgba(103,126,119,.12);border-radius:16px;background:#f3f2ec;color:#526b73;font:inherit;font-size:18px;padding:0 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;box-shadow:0 5px 14px rgba(83,102,96,.05)}
      .morandi-deadline-btn::after,.morandi-option-date-btn::after{content:'▾';display:grid;place-items:center;width:34px;height:34px;border-radius:12px;background:#cadbd5;color:#4f7168;font-size:16px;flex:0 0 auto}
      .morandi-deadline-btn.has-value,.morandi-option-date-btn.has-value{background:#edf2ef;color:#3f665f}
      .morandi-picker-backdrop{position:fixed;inset:0;z-index:10000;background:rgba(67,75,72,.30);backdrop-filter:blur(7px);display:grid;place-items:center;padding:18px;animation:morandiFade .16s ease}
      .morandi-picker{width:min(500px,calc(100vw - 28px));max-height:calc(100dvh - 30px);overflow:auto;border-radius:28px;background:#f4f1e9;padding:22px;box-shadow:0 24px 70px rgba(54,70,66,.22);color:#48616a}
      .morandi-picker-head{display:grid;grid-template-columns:48px 1fr 48px;align-items:center;gap:10px;margin-bottom:15px}.morandi-picker-head button{border:0;width:44px;height:44px;border-radius:14px;background:#d9e3dc;color:#4f6e66;font-size:24px;cursor:pointer}.morandi-picker-month{text-align:center;font-size:22px;letter-spacing:.05em}
      .morandi-weekdays,.morandi-days{display:grid;grid-template-columns:repeat(7,1fr);gap:7px}.morandi-weekdays{margin-bottom:7px}.morandi-weekdays span{text-align:center;font-size:13px;color:#879590;padding:6px 0}.morandi-day{aspect-ratio:1/1;border:0;border-radius:14px;background:#ebece6;color:#516871;font-size:16px;cursor:pointer;transition:transform .12s ease,background .12s ease}.morandi-day:hover{transform:translateY(-1px);background:#dbe7e1}.morandi-day.other{opacity:.38}.morandi-day.today{box-shadow:inset 0 0 0 1.5px #9dbdb4}.morandi-day.selected{background:#b9d7cf;color:#315f56;box-shadow:0 5px 12px rgba(105,147,135,.18)}
      .morandi-time-card{margin-top:18px;padding:16px;border-radius:20px;background:#e6e6dd}.morandi-time-title{text-align:center;font-size:15px;color:#788b88;margin-bottom:12px}.morandi-period{display:flex;justify-content:center;gap:8px;margin-bottom:12px}.morandi-period button{border:0;border-radius:999px;padding:9px 20px;background:#dddccf;color:#65767a;font-size:15px;cursor:pointer}.morandi-period button.active{background:#c9dae6;color:#466777}.morandi-time-row{display:grid;grid-template-columns:44px minmax(66px,1fr) 44px 18px 44px minmax(66px,1fr) 44px;gap:7px;align-items:center}.morandi-time-row button{border:0;height:42px;border-radius:999px;background:#d2dfda;color:#4b6e65;font-size:22px;cursor:pointer}.morandi-time-value{height:44px;border-radius:999px;background:#d7e2ec;display:grid;place-items:center;color:#486a78;font-size:19px}.morandi-colon{text-align:center;font-size:20px;color:#778a87}
      .morandi-picker-actions{display:grid;grid-template-columns:1fr 1.5fr;gap:10px;margin-top:18px}.morandi-picker-actions button{border:0;min-height:50px;border-radius:16px;font-size:17px;cursor:pointer}.morandi-clear{background:#e8dfd5;color:#8a7166}.morandi-confirm{background:#afd1c8;color:#315f57}
      .inline-add .morandi-option-date-btn{flex:1;min-width:0;text-align:left}.inline-add.option-date-active #optionInput{position:absolute!important;opacity:0!important;pointer-events:none!important;width:1px!important;height:1px!important}.morandi-option-date-btn.hidden{display:none!important}
      @keyframes morandiFade{from{opacity:0}to{opacity:1}}@media(max-width:600px){.morandi-picker{padding:17px;border-radius:23px}.morandi-picker-month{font-size:20px}.morandi-day{border-radius:12px;font-size:15px}.morandi-time-row{grid-template-columns:40px 1fr 40px 14px 40px 1fr 40px;gap:5px}.morandi-deadline-btn,.morandi-option-date-btn{font-size:16px}}
    `;document.head.appendChild(style);
  }

  function buildCalendar({selected,onConfirm,onClear,withTime=false,requireFuture=false,label='選擇日期'}){
    const now=new Date();let picked=selected instanceof Date&&!Number.isNaN(selected.getTime())?new Date(selected):new Date();picked.setSeconds(0,0);let view=new Date(picked.getFullYear(),picked.getMonth(),1),hour=picked.getHours(),minute=picked.getMinutes();
    const backdrop=document.createElement('div');backdrop.className='morandi-picker-backdrop';backdrop.innerHTML=`<div class="morandi-picker" role="dialog" aria-modal="true" aria-label="${label}"><div class="morandi-picker-head"><button type="button" data-prev aria-label="上個月">‹</button><div class="morandi-picker-month"></div><button type="button" data-next aria-label="下個月">›</button></div><div class="morandi-weekdays"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div><div class="morandi-days"></div>${withTime?`<div class="morandi-time-card"><div class="morandi-time-title">選擇時間</div><div class="morandi-period"><button type="button" data-period="am">上午</button><button type="button" data-period="pm">下午</button></div><div class="morandi-time-row"><button type="button" data-hminus>−</button><div class="morandi-time-value" data-hour></div><button type="button" data-hplus>＋</button><div class="morandi-colon">:</div><button type="button" data-mminus>−</button><div class="morandi-time-value" data-minute></div><button type="button" data-mplus>＋</button></div></div>`:''}<div class="morandi-picker-actions"><button type="button" class="morandi-clear" data-clear>清除</button><button type="button" class="morandi-confirm" data-confirm>確定</button></div></div>`;document.body.appendChild(backdrop);
    const monthLabel=backdrop.querySelector('.morandi-picker-month'),days=backdrop.querySelector('.morandi-days');
    const renderDays=()=>{monthLabel.textContent=`${view.getFullYear()} 年 ${view.getMonth()+1} 月`;days.innerHTML='';const start=new Date(view.getFullYear(),view.getMonth(),1-view.getDay());for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const b=document.createElement('button');b.type='button';b.className='morandi-day';b.textContent=String(d.getDate());if(d.getMonth()!==view.getMonth())b.classList.add('other');if(sameDate(d,new Date()))b.classList.add('today');if(sameDate(d,picked))b.classList.add('selected');b.onclick=()=>{picked=new Date(d.getFullYear(),d.getMonth(),d.getDate(),hour,minute);view=new Date(d.getFullYear(),d.getMonth(),1);renderDays()};days.appendChild(b)}};
    if(withTime){const hourEl=backdrop.querySelector('[data-hour]'),minuteEl=backdrop.querySelector('[data-minute]');const renderTime=()=>{hourEl.textContent=pad(hour%12||12);minuteEl.textContent=pad(minute);backdrop.querySelectorAll('[data-period]').forEach(b=>b.classList.toggle('active',b.dataset.period===(hour>=12?'pm':'am')))};const syncTime=()=>{picked.setHours(hour,minute,0,0);renderTime()};backdrop.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{if(b.dataset.period==='am'&&hour>=12)hour-=12;if(b.dataset.period==='pm'&&hour<12)hour+=12;syncTime()});backdrop.querySelector('[data-hminus]').onclick=()=>{hour=(hour+23)%24;syncTime()};backdrop.querySelector('[data-hplus]').onclick=()=>{hour=(hour+1)%24;syncTime()};backdrop.querySelector('[data-mminus]').onclick=()=>{minute=(minute+55)%60;syncTime()};backdrop.querySelector('[data-mplus]').onclick=()=>{minute=(minute+5)%60;syncTime()};renderTime()}
    backdrop.querySelector('[data-prev]').onclick=()=>{view=new Date(view.getFullYear(),view.getMonth()-1,1);renderDays()};backdrop.querySelector('[data-next]').onclick=()=>{view=new Date(view.getFullYear(),view.getMonth()+1,1);renderDays()};backdrop.querySelector('[data-clear]').onclick=()=>{onClear?.();backdrop.remove()};backdrop.querySelector('[data-confirm]').onclick=()=>{if(withTime)picked.setHours(hour,minute,0,0);else picked.setHours(0,0,0,0);if(requireFuture&&picked.getTime()<=Date.now()){showToast('截止時間要晚於現在');return}onConfirm?.(picked);backdrop.remove()};backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.remove()});renderDays();
  }

  function initMorandiDeadlinePicker(){
    const native=document.querySelector('#voteDeadlineInput');if(!native||document.querySelector('#morandiDeadlineBtn'))return;ensureMorandiStyles();
    const display=document.createElement('button');display.id='morandiDeadlineBtn';display.type='button';display.className='morandi-deadline-btn';native.insertAdjacentElement('afterend',display);
    const toLocalValue=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const refresh=()=>{if(native.value){const d=new Date(native.value);display.textContent=`${d.getFullYear()} / ${pad(d.getMonth()+1)} / ${pad(d.getDate())}　${d.getHours()<12?'上午':'下午'} ${pad(d.getHours()%12||12)}:${pad(d.getMinutes())}`}else display.textContent='選擇日期與時間';display.classList.toggle('has-value',!!native.value);const disabled=typeof data!=='undefined'&&(!isHost||data.phase!=='setup');display.disabled=!!disabled;display.style.opacity=disabled?'.55':'1'};
    display.onclick=()=>{if(display.disabled)return;const selected=native.value?new Date(native.value):new Date(Date.now()+60*60*1000);buildCalendar({selected,withTime:true,requireFuture:true,label:'選擇投票截止時間',onClear:()=>{native.value='';native.dispatchEvent(new Event('change',{bubbles:true}));refresh()},onConfirm:d=>{native.value=toLocalValue(d);native.dispatchEvent(new Event('change',{bubbles:true}));refresh()}})};native.addEventListener('change',refresh);setInterval(refresh,1000);refresh();
  }

  function initMorandiOptionDatePicker(){
    const native=document.querySelector('#optionInput'),wrap=native?.closest('.inline-add');if(!native||!wrap||document.querySelector('#morandiOptionDateBtn'))return;ensureMorandiStyles();
    const display=document.createElement('button');display.id='morandiOptionDateBtn';display.type='button';display.className='morandi-option-date-btn hidden';display.textContent='選擇日期';native.insertAdjacentElement('afterend',display);
    const refresh=()=>{const dateMode=typeof data!=='undefined'&&data.optionMode==='date',disabled=typeof data!=='undefined'&&(!isHost||data.phase!=='setup');wrap.classList.toggle('option-date-active',dateMode);display.classList.toggle('hidden',!dateMode);display.disabled=!!disabled;if(dateMode){display.textContent=native.value?native.value.replaceAll('-',' / '):'選擇日期';display.classList.toggle('has-value',!!native.value)}};
    display.onclick=()=>{if(display.disabled)return;const selected=/^\d{4}-\d{2}-\d{2}$/.test(native.value)?new Date(`${native.value}T00:00:00`):new Date();buildCalendar({selected,withTime:false,requireFuture:false,label:'選擇日期',onClear:()=>{native.value='';native.dispatchEvent(new Event('input',{bubbles:true}));native.dispatchEvent(new Event('change',{bubbles:true}));refresh()},onConfirm:d=>{native.value=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;native.dispatchEvent(new Event('input',{bubbles:true}));native.dispatchEvent(new Event('change',{bubbles:true}));refresh()}})};
    native.addEventListener('input',refresh);native.addEventListener('change',refresh);setInterval(refresh,300);refresh();
  }

  initMorandiDeadlinePicker();initMorandiOptionDatePicker();
  setInterval(applyFlowRules,1000);applyFlowRules();
  const qs=new URL(location.href).searchParams,loginResult=qs.get('line_login');if(loginResult){history.replaceState({},'',location.pathname+location.hash);if(loginResult==='success')showToast('LINE 登入成功');else if(loginResult==='cancelled')showToast('已取消 LINE 登入');else if(loginResult==='not_configured')showToast('LINE Login 尚未完成設定');else showToast('LINE 登入失敗，請再試一次')}
  loadSession();
})();