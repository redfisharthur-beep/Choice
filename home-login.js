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
    try{
      const key='choice-app-v4',saved=JSON.parse(localStorage.getItem(key)||'{}');
      saved.displayName=name;localStorage.setItem(key,JSON.stringify(saved));
    }catch{}
    return name;
  };
  const setLineUi=user=>{
    lineUser=user||null;
    if(!lineBtn)return;
    lineBtn.classList.toggle('line-authenticated',!!lineUser);
    lineBtn.title=lineUser?`已使用 LINE 登入：${lineUser.displayName}`:'LINE 登入';
    lineBtn.setAttribute('aria-label',lineBtn.title);
    if(lineUser){
      localStorage.setItem('choice-line-user-id',lineUser.userId||'');
      localStorage.setItem('choice-line-picture',lineUser.pictureUrl||'');
    }else{
      localStorage.removeItem('choice-line-user-id');
      localStorage.removeItem('choice-line-picture');
    }
  };
  const loadSession=async()=>{
    try{
      const r=await fetch('/api/auth/me',{cache:'no-store',credentials:'same-origin'}),j=await r.json();
      if(j.authenticated&&j.user){
        setLineUi(j.user);
        if(input){input.value=j.user.displayName||input.value;syncName(input.value)}
      }else setLineUi(null);
    }catch{setLineUi(null)}
  };

  const currentVoteFlow=()=>{
    try{
      if(typeof data==='undefined'||!data?.roomCode)return {room:false,host:false,phase:'setup',tie:false};
      const options=Array.isArray(data.options)?data.options:[];
      const max=options.reduce((m,o)=>Math.max(m,Math.max(0,Number(o?.votes)||0)),0);
      const tie=max>0&&options.filter(o=>(Number(o?.votes)||0)===max).length>1;
      return {room:true,host:typeof isHost!=='undefined'&&!!isHost,phase:String(data.phase||'setup'),tie};
    }catch{return {room:false,host:false,phase:'setup',tie:false}}
  };

  const applyFlowRules=()=>{
    const flow=currentVoteFlow();
    const nav=document.querySelector('#flowNav');
    if(!nav)return;
    const setup=nav.querySelector('[data-step="setup"]'),vote=nav.querySelector('[data-step="vote"]'),analysis=nav.querySelector('[data-step="analysis"]'),draw=nav.querySelector('[data-step="draw"]');
    const analysisDraw=document.querySelector('#analysisDrawBtn'),announceVote=document.querySelector('#announceVoteBtn');
    if(!flow.room||!flow.host){
      [setup,vote,analysis,draw].forEach(b=>{if(b)b.disabled=true});
      return;
    }
    if(flow.phase==='setup'){
      if(setup)setup.disabled=false;
      if(vote)vote.disabled=true;
      if(analysis)analysis.disabled=true;
      if(draw)draw.disabled=true;
      if(analysisDraw)analysisDraw.classList.add('hidden');
      if(announceVote)announceVote.classList.add('hidden');
      return;
    }
    if(flow.phase==='voting'){
      if(setup)setup.disabled=true;
      if(vote)vote.disabled=false;
      if(analysis)analysis.disabled=true;
      if(draw)draw.disabled=true;
      if(analysisDraw)analysisDraw.classList.add('hidden');
      if(announceVote)announceVote.classList.add('hidden');
      return;
    }
    if(flow.phase==='closed'){
      if(setup)setup.disabled=true;
      if(vote)vote.disabled=true;
      if(analysis)analysis.disabled=false;
      if(draw)draw.disabled=!flow.tie;
      if(analysisDraw)analysisDraw.classList.toggle('hidden',!flow.tie);
      if(analysisDraw)analysisDraw.disabled=!flow.tie;
      if(announceVote)announceVote.classList.add('hidden');
      return;
    }
    if(flow.phase==='draw'){
      if(setup)setup.disabled=true;
      if(vote)vote.disabled=true;
      if(analysis)analysis.disabled=!flow.tie;
      if(draw)draw.disabled=false;
      if(analysisDraw)analysisDraw.classList.add('hidden');
      if(announceVote)announceVote.classList.add('hidden');
    }
  };

  document.addEventListener('click',e=>{
    const target=e.target.closest?.('#flowNav button,#analysisDrawBtn,#announceVoteBtn');
    if(!target)return;
    const flow=currentVoteFlow();
    if(!flow.room||!flow.host)return;
    let blocked=false;
    if(flow.phase==='voting')blocked=true;
    else if(target.id==='announceVoteBtn')blocked=true;
    else if((target.id==='analysisDrawBtn'||target.dataset?.step==='draw')&&flow.phase==='closed'&&!flow.tie)blocked=true;
    else if(target.dataset?.step==='analysis'&&flow.phase!=='closed'&&flow.phase!=='draw')blocked=true;
    if(blocked){
      e.preventDefault();e.stopImmediatePropagation();
      showToast(flow.phase==='voting'?'需等待投票截止，系統會自動結算':'只有最高票平分時才能抽籤');
    }
  },true);

  if(input){
    const saved=localStorage.getItem('choice-display-name')||'';
    if(!input.value)input.value=saved;
    input.addEventListener('input',()=>syncName(input.value));
    input.addEventListener('change',()=>syncName(input.value));
  }

  if(openRoomBtn){
    const original=openRoomBtn.onclick;
    openRoomBtn.onclick=e=>{
      const name=syncName(input?.value||'');
      if(!name){showToast('請先輸入名字');input?.focus();return}
      if(typeof original==='function')return original.call(openRoomBtn,e);
    };
  }

  if(lineBtn)lineBtn.onclick=async()=>{
    if(lineUser){showToast(`已使用 LINE 登入：${lineUser.displayName}`);return}
    try{
      const r=await fetch('/api/auth/line/status',{cache:'no-store',credentials:'same-origin'}),j=await r.json();
      if(!j.configured){showToast('LINE Login 尚未完成後台設定');return}
      location.assign('/api/auth/line/start');
    }catch{showToast('LINE Login 目前無法連線')}
  };

  if(roomList){
    const searchWrap=document.createElement('div');
    searchWrap.className='room-search';
    searchWrap.innerHTML='<button id="roomSearchToggle" class="room-search-toggle" type="button" aria-label="搜尋房間" title="搜尋房間"><img src="./assets/hero/search.png" alt="搜尋"></button><input id="roomSearchInput" class="room-search-input" type="search" maxlength="40" placeholder="輸入房間關鍵字" aria-label="輸入房間關鍵字">';
    roomList.before(searchWrap);
    const searchToggle=searchWrap.querySelector('#roomSearchToggle');
    const searchInput=searchWrap.querySelector('#roomSearchInput');
    const applyRoomFilter=()=>{
      const q=String(searchInput?.value||'').trim().toLowerCase();
      roomList.querySelectorAll('[data-room-code]').forEach(card=>{
        const title=String(card.querySelector('.room-list-name')?.textContent||'').trim().toLowerCase();
        const code=String(card.dataset.roomCode||'').trim().toLowerCase();
        const match=!q||title.includes(q)||code.includes(q);
        if(match){card.style.removeProperty('display');card.removeAttribute('aria-hidden')}
        else{card.style.setProperty('display','none','important');card.setAttribute('aria-hidden','true')}
      });
    };
    searchToggle?.addEventListener('click',()=>{
      const open=searchWrap.classList.toggle('open');
      if(open)setTimeout(()=>searchInput?.focus(),40);
      else if(searchInput){searchInput.value='';applyRoomFilter()}
    });
    searchInput?.addEventListener('input',applyRoomFilter);
    searchInput?.addEventListener('search',applyRoomFilter);
    searchInput?.addEventListener('compositionend',applyRoomFilter);
    searchInput?.addEventListener('keyup',applyRoomFilter);
    searchInput?.addEventListener('keydown',e=>{if(e.key==='Escape'){searchInput.value='';searchWrap.classList.remove('open');applyRoomFilter();searchInput.blur()}});
    new MutationObserver(()=>queueMicrotask(applyRoomFilter)).observe(roomList,{childList:true,subtree:true});
  }

  const roomView=document.querySelector('#roomView');
  if(roomView)new MutationObserver(()=>queueMicrotask(applyFlowRules)).observe(roomView,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
  setInterval(applyFlowRules,300);
  applyFlowRules();

  const qs=new URL(location.href).searchParams,loginResult=qs.get('line_login');
  if(loginResult){
    history.replaceState({},'',location.pathname+location.hash);
    if(loginResult==='success')showToast('LINE 登入成功');
    else if(loginResult==='cancelled')showToast('已取消 LINE 登入');
    else if(loginResult==='not_configured')showToast('LINE Login 尚未完成設定');
    else showToast('LINE 登入失敗，請再試一次');
  }

  loadSession();
})();