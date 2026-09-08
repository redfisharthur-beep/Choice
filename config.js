window.CHOICE_CONFIG={
  apiBase:"",
  realtimeEnabled:false,
  lineOfficialUrl:"https://lin.ee/t5BkC6O",
  lineCommunityUrl:"https://line.me/ti/g2/k29Jk_pZmJCCqt5jUZjxOLnv8RNnabWLeuFu4Q?utm_source=invitation&utm_medium=link_copy&utm_campaign=default"
};

(()=>{
  const STYLE_ID='choice-room-ui';
  const css=`
    /* Room toolbar: artwork only, no capsule background */
    body:has(#roomView:not(.hidden)) .hero-actions{
      border:0!important;
      border-radius:0!important;
      background:transparent!important;
      box-shadow:none!important;
      backdrop-filter:none!important;
      -webkit-backdrop-filter:none!important;
    }
    body:has(#roomView:not(.hidden)) .hero-action-btn,
    body:has(#roomView:not(.hidden)) .hero-actions > a.hero-action-btn{
      border:0!important;
      border-radius:0!important;
      background:transparent!important;
      box-shadow:none!important;
    }
    body:has(#roomView:not(.hidden)) #lineReminderBtn{
      transform:translateX(10px)!important;
    }

    /* Room content order: chat -> online members -> utility buttons */
    body:has(#roomView:not(.hidden)) #roomView{
      display:flex!important;
      flex-direction:column!important;
    }
    body:has(#roomView:not(.hidden)) .choice-chat{order:90!important;}
    body:has(#roomView:not(.hidden)) .player-strip{order:91!important;}
    body:has(#roomView:not(.hidden)) .room-utility-actions{order:92!important;}

    /* Online members */
    body:has(#roomView:not(.hidden)) .player-strip{
      margin:14px 0 0!important;
      padding:0!important;
      border:0!important;
      border-radius:0!important;
      background:transparent!important;
      box-shadow:none!important;
    }
    body:has(#roomView:not(.hidden)) .player-strip-head{
      display:flex!important;
      align-items:center!important;
      justify-content:space-between!important;
      gap:12px!important;
      margin:0 0 10px!important;
      padding:0 4px!important;
      color:#60757c!important;
      font-size:17px!important;
    }
    body:has(#roomView:not(.hidden)) .player-strip-head::before{
      content:"在線成員";
      font-size:18px!important;
    }
    body:has(#roomView:not(.hidden)) #playerList{
      display:flex!important;
      flex-direction:column!important;
      gap:10px!important;
      width:100%!important;
    }
    body:has(#roomView:not(.hidden)) #playerList .player-chip{
      width:100%!important;
      min-height:58px!important;
      display:grid!important;
      grid-template-columns:minmax(0,1fr) auto!important;
      align-items:center!important;
      gap:12px!important;
      margin:0!important;
      padding:12px 16px!important;
      box-sizing:border-box!important;
      border:1px solid rgba(93,112,106,.14)!important;
      border-radius:16px!important;
      box-shadow:0 4px 12px rgba(75,88,82,.04)!important;
      color:#536a72!important;
    }
    body:has(#roomView:not(.hidden)) #playerList .player-chip:nth-child(6n+1){background:#efe4de!important;}
    body:has(#roomView:not(.hidden)) #playerList .player-chip:nth-child(6n+2){background:#e7ece4!important;}
    body:has(#roomView:not(.hidden)) #playerList .player-chip:nth-child(6n+3){background:#e4e9f0!important;}
    body:has(#roomView:not(.hidden)) #playerList .player-chip:nth-child(6n+4){background:#eee8dc!important;}
    body:has(#roomView:not(.hidden)) #playerList .player-chip:nth-child(6n+5){background:#e3ece8!important;}
    body:has(#roomView:not(.hidden)) #playerList .player-chip:nth-child(6n+6){background:#eee5ea!important;}
    body:has(#roomView:not(.hidden)) #playerList .player-name{
      min-width:0!important;
      font-weight:700!important;
    }
    body:has(#roomView:not(.hidden)) #playerList .player-choice{
      justify-self:end!important;
      max-width:52vw!important;
      padding-left:12px!important;
      border-left:1px solid rgba(91,108,102,.16)!important;
      color:#6c807f!important;
      text-align:right!important;
      white-space:normal!important;
    }

    /* Chat: stable Morandi tone per IP-derived server tone */
    body:has(#roomView:not(.hidden)) .choice-chat-msg[data-tone="0"]{background:#efe4de!important;}
    body:has(#roomView:not(.hidden)) .choice-chat-msg[data-tone="1"]{background:#e7ece4!important;}
    body:has(#roomView:not(.hidden)) .choice-chat-msg[data-tone="2"]{background:#e4e9f0!important;}
    body:has(#roomView:not(.hidden)) .choice-chat-msg[data-tone="3"]{background:#eee8dc!important;}
    body:has(#roomView:not(.hidden)) .choice-chat-msg[data-tone="4"]{background:#e3ece8!important;}
    body:has(#roomView:not(.hidden)) .choice-chat-msg[data-tone="5"]{background:#eee5ea!important;}
    body:has(#roomView:not(.hidden)) .choice-chat-msg[data-tone="6"]{background:#e4ebe7!important;}
    body:has(#roomView:not(.hidden)) .choice-chat-msg[data-tone="7"]{background:#e7e3ed!important;}
    body:has(#roomView:not(.hidden)) .choice-chat-msg{
      border:1px solid rgba(94,111,106,.10)!important;
      transition:background-color .12s ease!important;
    }
    body:has(#roomView:not(.hidden)) .choice-chat-msg b{
      font-weight:700!important;
    }

    @media(max-width:600px){
      body:has(#roomView:not(.hidden)) #playerList .player-chip{
        min-height:54px!important;
        padding:11px 14px!important;
      }
      body:has(#roomView:not(.hidden)) #playerList .player-choice{
        max-width:48vw!important;
        font-size:14px!important;
      }
    }
  `;

  function ensureStyles(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=css;
    document.head.appendChild(style);
  }

  function syncRoomUi(){
    ensureStyles();
    const chat=document.querySelector('#choiceChat');
    const players=document.querySelector('#roomView .player-strip');
    const utility=document.querySelector('#roomView .room-utility-actions');
    if(chat&&players&&chat.nextElementSibling!==players)chat.insertAdjacentElement('afterend',players);
    if(players&&utility&&players.nextElementSibling!==utility)players.insertAdjacentElement('afterend',utility);

    const input=document.querySelector('#choiceChatInput');
    if(input&&input.placeholder!=='發表你的看法')input.placeholder='發表你的看法';

    const nodes=[...document.querySelectorAll('#choiceChatList .choice-chat-msg')];
    let messages=[];
    try{if(typeof chatMessages!=='undefined'&&Array.isArray(chatMessages))messages=chatMessages}catch{}
    nodes.forEach((node,index)=>{
      const tone=Number(messages[index]?.tone);
      if(Number.isFinite(tone))node.dataset.tone=String(((tone%8)+8)%8);
    });
  }

  function init(){
    ensureStyles();
    syncRoomUi();
    const observer=new MutationObserver(()=>requestAnimationFrame(syncRoomUi));
    observer.observe(document.body,{childList:true,subtree:true});
    setInterval(syncRoomUi,400);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();

(()=>{
  const bgm=new Audio('./assets/music/choice.mp3');
  bgm.loop=true;
  bgm.volume=0.2;
  bgm.preload='auto';

  const dartsSfx=new Audio('./assets/music/darts.mp3');
  dartsSfx.volume=0.5;
  dartsSfx.preload='auto';

  const startBgm=()=>{
    bgm.volume=0.2;
    bgm.play().catch(()=>{});
  };

  startBgm();
  ['pointerdown','touchstart','keydown'].forEach(type=>{
    document.addEventListener(type,startBgm,{once:true,capture:true});
  });

  const playDarts=()=>{
    try{
      dartsSfx.pause();
      dartsSfx.currentTime=0;
      dartsSfx.volume=0.5;
      dartsSfx.play().catch(()=>{});
    }catch{}
  };

  let wasDrawFocus=document.body.classList.contains('draw-focus-mode');
  let dartsTimer=null;
  const watchDrawFocus=()=>{
    const active=document.body.classList.contains('draw-focus-mode');
    if(active&&!wasDrawFocus){
      if(dartsTimer)clearTimeout(dartsTimer);
      dartsTimer=setTimeout(playDarts,1000);
    }
    if(!active&&dartsTimer){clearTimeout(dartsTimer);dartsTimer=null;}
    wasDrawFocus=active;
  };

  const initAudioWatch=()=>{
    wasDrawFocus=document.body.classList.contains('draw-focus-mode');
    new MutationObserver(watchDrawFocus).observe(document.body,{attributes:true,attributeFilter:['class']});
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initAudioWatch,{once:true});
  else initAudioWatch();
})();
