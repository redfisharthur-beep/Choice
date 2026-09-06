(()=>{
  const input=document.querySelector('#hostNameInput');
  const lineBtn=document.querySelector('#lineLoginBtn');
  const openRoomBtn=document.querySelector('#openRoomBtn');
  const toastEl=document.querySelector('#toast');
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
