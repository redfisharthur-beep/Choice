window.CHOICE_CONFIG={
  apiBase:"",
  realtimeEnabled:false,
  lineOfficialUrl:"https://lin.ee/t5BkC6O",
  lineCommunityUrl:"https://line.me/ti/g2/k29Jk_pZmJCCqt5jUZjxOLnv8RNnabWLeuFu4Q?utm_source=invitation&utm_medium=link_copy&utm_campaign=default"
};
window.addEventListener('load',()=>{
  const loginGoBtn=document.querySelector('#homeLoginGoBtn');
  const loginGoImg=loginGoBtn?.querySelector('img');
  if(loginGoImg){
    loginGoImg.src='./assets/hero/go.png?v=202609062154';
    loginGoImg.alt='GO';
  }

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
