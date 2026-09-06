(()=>{
  const roomList=document.querySelector('#roomList');
  const joinDialog=document.querySelector('#joinDialog');
  const joinPasswordInput=document.querySelector('#joinPasswordInput');
  const joinNameInput=document.querySelector('#joinNameInput');
  const joinBtn=document.querySelector('#joinWithPasswordBtn');
  const homeNameInput=document.querySelector('#hostNameInput');
  if(!roomList||!joinDialog||!joinPasswordInput||!joinNameInput||!joinBtn)return;

  const getSavedName=()=>String(homeNameInput?.value||localStorage.getItem('choice-display-name')||'').trim().slice(0,20);
  const warnName=()=>{if(typeof window.toast==='function')window.toast('請先在首頁輸入名字');else alert('請先在首頁輸入名字')};

  roomList.onclick=e=>{
    const b=e.target.closest('[data-room-code]');
    if(!b)return;
    const code=String(b.dataset.roomCode||'').toUpperCase();
    const locked=b.dataset.locked==='1';
    const name=getSavedName();
    if(!name)return warnName();
    localStorage.setItem('choice-display-name',name);
    joinNameInput.value=name;
    if(!locked){
      if(typeof window.attemptJoin==='function')window.attemptJoin(code,'',name);
      return;
    }
    joinDialog.dataset.roomCode=code;
    joinPasswordInput.value='';
    joinDialog.showModal();
    setTimeout(()=>joinPasswordInput.focus(),40);
  };

  joinBtn.onclick=()=>{
    const code=String(joinDialog.dataset.roomCode||'').toUpperCase();
    const name=getSavedName();
    if(!name){joinDialog.close();return warnName()}
    if(!code)return;
    joinDialog.close();
    if(typeof window.attemptJoin==='function')window.attemptJoin(code,joinPasswordInput.value,name);
  };
})();
