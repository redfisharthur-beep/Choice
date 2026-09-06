(()=>{
  const input=document.querySelector('#hostNameInput');
  const lineBtn=document.querySelector('#lineLoginBtn');
  const openRoomBtn=document.querySelector('#openRoomBtn');
  const toastEl=document.querySelector('#toast');
  const showToast=text=>{if(!toastEl)return;toastEl.textContent=text;toastEl.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>toastEl.classList.remove('show'),1800)};
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
  if(lineBtn)lineBtn.onclick=()=>showToast('LINE 登入尚未設定');
})();