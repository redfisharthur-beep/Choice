window.CHOICE_CONFIG={
  apiBase:"",
  realtimeEnabled:false,
  lineOfficialUrl:"https://lin.ee/t5BkC6O",
  lineCommunityUrl:"https://line.me/ti/g2/k29Jk_pZmJCCqt5jUZjxOLnv8RNnabWLeuFu4Q?utm_source=invitation&utm_medium=link_copy&utm_campaign=default"
};

function syncHomeGoButton(){
  const btn=document.querySelector('#homeContinueBtn');
  if(!btn)return;
  btn.classList.remove('hidden');
  btn.style.setProperty('display','block','important');
  btn.style.setProperty('visibility','visible','important');
  btn.style.setProperty('opacity','1','important');
  const img=btn.querySelector('img');
  if(!img)return;
  img.src='./assets/hero/go.png?v=202609062207';
  img.alt='GO';
  img.style.setProperty('display','block','important');
  img.style.setProperty('visibility','visible','important');
  img.style.setProperty('opacity','1','important');
  img.style.setProperty('width','100%','important');
  img.style.setProperty('height','auto','important');
}

// config.js is loaded after the home markup, so update the button immediately.
syncHomeGoButton();

document.addEventListener('DOMContentLoaded',syncHomeGoButton,{once:true});
window.addEventListener('pageshow',syncHomeGoButton);
window.addEventListener('load',()=>{
  syncHomeGoButton();

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