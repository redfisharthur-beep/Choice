window.CHOICE_CONFIG={
  apiBase:"",
  realtimeEnabled:false,
  lineOfficialUrl:"https://lin.ee/t5BkC6O",
  lineCommunityUrl:"https://line.me/ti/g2/k29Jk_pZmJCCqt5jUZjxOLnv8RNnabWLeuFu4Q?utm_source=invitation&utm_medium=link_copy&utm_campaign=default"
};

// The home topic image is the entry point for opening the room setup dialog.
// Bind it directly so it does not depend on the later app.js/home-login.js onclick chain.
(()=>{
  const btn=document.querySelector('#openRoomBtn');
  if(!btn)return;
  btn.addEventListener('click',e=>{
    const input=document.querySelector('#hostNameInput');
    const dialog=document.querySelector('#openRoomDialog');
    const name=String(input?.value||localStorage.getItem('choice-display-name')||'').trim().slice(0,20);
    if(!name){
      e.preventDefault();
      e.stopImmediatePropagation();
      const toast=document.querySelector('#toast');
      if(toast){toast.textContent='請先輸入名字';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800)}
      input?.focus();
      return;
    }
    localStorage.setItem('choice-display-name',name);
    if(dialog&&!dialog.open){
      e.preventDefault();
      e.stopImmediatePropagation();
      dialog.showModal();
    }
  },true);
})();

window.addEventListener('load',()=>{
  const load=(src,key)=>new Promise(resolve=>{
    if(document.querySelector(`script[${key}]`))return resolve();
    const s=document.createElement('script');
    s.src=src;
    s.setAttribute(key,'1');
    s.onload=resolve;
    s.onerror=resolve;
    document.body.appendChild(s);
  });
  (async()=>{
    await load('./vote-chat-tweaks.js','data-choice-vote-chat-tweaks');
    await load('./participant-draw-fix.js','data-choice-participant-draw-fix');
  })();
});
