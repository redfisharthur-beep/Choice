(()=>{
  const $=s=>document.querySelector(s);
  const FALLBACK_LINE_URL='https://lin.ee/t5BkC6O';
  const showToast=text=>{const el=$('#toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.classList.remove('show'),2600)};
  const currentRoom=()=>String($('#roomCodeText')?.textContent||'').trim().toUpperCase();
  const copyCommand=command=>navigator.clipboard?.writeText?navigator.clipboard.writeText(command):Promise.reject();
  let botInfoCache=null;

  async function getBotInfo(){
    if(botInfoCache?.basicId)return botInfoCache;
    try{
      const r=await fetch('/api/line/bot-info',{cache:'no-store'});
      const j=await r.json().catch(()=>({}));
      if(!r.ok||!j.tokenValid||!j.basicId)return {ok:false,error:j.error||'Messaging API 尚未完成'};
      botInfoCache={ok:true,basicId:String(j.basicId),displayName:String(j.displayName||'Choice')};
      return botInfoCache;
    }catch{return {ok:false,error:'無法讀取 LINE 官方帳號資訊'}}
  }

  async function messagingReady(){
    const info=await getBotInfo();
    return !!info.ok;
  }

  async function openOfficialLine(ev){
    ev?.preventDefault?.();
    const info=await getBotInfo();
    if(!info.ok){showToast('LINE 官方帳號尚未連線完成');location.href=FALLBACK_LINE_URL;return}
    const id=info.basicId;
    const appUrl=`line://ti/p/${id}`;
    const webUrl=`https://line.me/R/ti/p/${encodeURIComponent(id)}`;
    let hidden=false;
    const onVisibility=()=>{if(document.hidden)hidden=true};
    document.addEventListener('visibilitychange',onVisibility,{once:true});
    location.href=appUrl;
    setTimeout(()=>{
      if(!hidden&&document.visibilityState==='visible')location.href=webUrl;
    },1200);
  }

  const btn=$('#lineReminderBtn');
  if(btn)btn.onclick=async()=>{
    const code=currentRoom();
    if(!/^[A-Z0-9]{6}$/.test(code))return showToast('請先進入房間');
    if(!await messagingReady())return showToast('LINE 通知後台尚未完成，請檢查 Messaging API 設定');
    const command=`綁定 ${code}`;
    const hidden=$('#lineBindCommand');
    if(hidden)hidden.textContent=command;
    $('#lineReminderDialog')?.showModal();
  };

  const copy=$('#copyLineBindBtn');
  if(copy)copy.onclick=async()=>{
    const text=String($('#lineBindCommand')?.textContent||'').trim();
    if(!/^綁定\s+[A-Z0-9]{6}$/i.test(text))return showToast('綁定指令尚未產生');
    try{await copyCommand(text);showToast('綁定指令已複製，請傳送到官方 LINE')}
    catch{showToast('請允許瀏覽器使用剪貼簿')}
  };

  const open=$('#openLineBindBtn');
  if(open){
    open.href='#';
    open.onclick=openOfficialLine;
  }

  function fixChatLayout(){
    const chat=$('#choiceChat');
    const actions=document.querySelector('.room-utility-actions');
    if(!chat)return;
    chat.querySelector('.choice-chat-title')?.remove();
    chat.querySelectorAll('.choice-chat-empty').forEach(el=>el.remove());
    const input=chat.querySelector('#choiceChatInput');
    if(input)input.placeholder='發表你的看法';
    if(actions&&chat.nextElementSibling!==actions)actions.parentNode?.insertBefore(chat,actions);
  }

  fixChatLayout();
  const chatObserver=new MutationObserver(()=>fixChatLayout());
  chatObserver.observe(document.body,{childList:true,subtree:true});
})();

/* Draw UI v2: dart button on top, vertical choices, target only during animation. */
(()=>{
  const $=s=>document.querySelector(s);
  const escDraw=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

  const style=document.createElement('style');
  style.id='choiceDrawV2Styles';
  style.textContent=`
#drawStep .draw-panel{display:block!important;padding:24px!important;overflow:visible!important}
#drawHostControls{display:flex!important;flex-direction:column!important;align-items:center!important;gap:18px!important;max-width:720px!important;margin:0 auto!important}
#drawHostControls #throwBtn{order:-2!important;width:min(210px,46vw)!important;margin:0 auto 4px!important;background:transparent!important;border:0!important;box-shadow:none!important;padding:0!important}
#drawHostControls #throwBtn img{display:block!important;width:100%!important;height:auto!important;object-fit:contain!important}
#drawChecks{order:-1!important;width:min(660px,100%)!important;display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;gap:12px!important;margin:0 auto!important}
#drawChecks .draw-check{width:100%!important;min-height:66px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:14px!important;padding:10px 18px!important;margin:0!important;border-radius:20px!important;background:rgba(247,247,242,.92)!important;border:2px solid rgba(107,132,125,.14)!important;color:#526b72!important;font-size:26px!important;line-height:1.2!important;box-shadow:none!important;transition:transform .28s ease,box-shadow .28s ease,background .28s ease,border-color .28s ease!important}
#drawChecks .draw-check input{width:25px!important;height:25px!important;flex:0 0 auto!important;accent-color:#79b8a9!important}
#drawChecks .draw-check.readonly{padding-left:20px!important}
#drawChecks .draw-check.readonly input{display:none!important}
#drawChecks .draw-check.draw-hit{position:relative!important;z-index:2!important;background:linear-gradient(105deg,#fff1a8 0%,#b9efd5 35%,#afdfff 68%,#ffd4e3 100%)!important;border-color:#fff!important;color:#244f5b!important;font-weight:1000!important;transform:scale(1.025)!important;box-shadow:0 0 0 3px rgba(119,191,224,.55),0 8px 28px rgba(115,204,181,.42),0 0 30px rgba(255,218,105,.5)!important}
#drawChecks .draw-check.draw-hit::after{content:'✦';margin-left:auto;font-size:28px;color:#fff;text-shadow:0 1px 8px rgba(71,135,121,.45)}
#drawChecks .draw-check.draw-disabled{opacity:.48!important}
#drawOptionSummary{display:none!important}
#drawResult{display:none!important}
#drawStep .draw-stage{min-height:0!important;padding:0!important;background:transparent!important;box-shadow:none!important;border:0!important}
#drawStep .draw-target-wrap{width:min(430px,78vw)!important;margin:0 auto!important}
.draw-focus-mode #drawHostControls{visibility:hidden!important}
.draw-focus-mode .draw-stage{display:grid!important;place-items:center!important;position:fixed!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;width:min(560px,94vw)!important;min-height:min(560px,78vh)!important;z-index:9991!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:0!important}
.draw-focus-mode .draw-target-wrap{display:grid!important;width:min(430px,78vw)!important}
.draw-focus-mode .draw-focus-backdrop{background:rgba(232,237,232,.95)!important;backdrop-filter:blur(8px)!important}
@media(max-width:600px){
  #drawStep .draw-panel{padding:18px 14px!important}
  #drawHostControls{gap:14px!important}
  #drawHostControls #throwBtn{width:min(176px,48vw)!important}
  #drawChecks{gap:9px!important}
  #drawChecks .draw-check{min-height:56px!important;font-size:21px!important;padding:8px 14px!important;border-radius:17px!important}
  #drawChecks .draw-check input{width:22px!important;height:22px!important}
  #drawChecks .draw-check.draw-hit::after{font-size:23px!important}
  .draw-focus-mode .draw-stage{width:96vw!important;min-height:68vh!important}
  .draw-focus-mode .draw-target-wrap{width:min(330px,82vw)!important}
}
`;
  document.head.appendChild(style);

  function drawShownResult(){
    return String(visibleDrawResult||data?.lastDraw||data?.firstDrawResult||'').trim();
  }

  function rebuildDrawChoices(){
    const checks=$('#drawChecks');
    const controls=$('#drawHostControls');
    const throwBtn=$('#throwBtn');
    if(!checks||!controls)return;
    if(throwBtn&&controls.firstElementChild!==throwBtn)controls.insertBefore(throwBtn,controls.firstElementChild);
    if(drawAnimating)return;

    const options=Array.isArray(data?.options)?data.options:[];
    const allowed=drawPoolOptions();
    const allowedIds=new Set(allowed.map(o=>String(o.id)));
    const hit=drawShownResult();

    if(isHost){
      checks.innerHTML=options.map(o=>{
        const id=String(o.id),enabled=allowedIds.has(id),checked=drawSelected.has(id),won=!!hit&&String(o.name)===hit;
        return `<label class="draw-check${won?' draw-hit':''}${enabled?'':' draw-disabled'}"><input type="checkbox" data-draw="${escDraw(id)}" ${checked?'checked':''} ${enabled?'':'disabled'}><span>${escDraw(o.name)}</span></label>`;
      }).join('');
    }else{
      checks.innerHTML=options.map(o=>{
        const won=!!hit&&String(o.name)===hit;
        return `<div class="draw-check readonly${won?' draw-hit':''}"><span>${escDraw(o.name)}</span></div>`;
      }).join('');
    }
  }

  const originalRender=render;
  render=function(){
    originalRender();
    rebuildDrawChoices();
    $('#drawOptionSummary')?.remove();
    const result=$('#drawResult');if(result){result.textContent='';result.classList.add('hidden')}
  };

  renderDrawOptions=function(){
    $('#drawOptionSummary')?.remove();
    rebuildDrawChoices();
  };

  setDrawStageActive=function(active){
    const wrap=$('.draw-target-wrap'),stage=$('.draw-stage');
    if(wrap)wrap.style.display=active?'grid':'none';
    if(stage){stage.style.minHeight=active?'500px':'0px';stage.style.display=active?'grid':'none'}
  };

  resetDrawVisual=function(){
    const wheel=$('#drawWheel'),dart=$('#drawDart'),result=$('#drawResult');
    wheel?.classList.remove('spinning','stopping');
    dart?.classList.remove('hit');
    document.body.classList.remove('draw-focus-mode');
    setDrawStageActive(false);
    if(result){result.textContent='';result.classList.add('hidden');result.classList.remove('reveal')}
  };

  playDrawAnimation=function(result='',markSeen=false){
    if(drawAnimTimer)clearTimeout(drawAnimTimer);
    drawAnimTimer=null;
    if(result)pendingDrawResult=String(result);
    drawAnimating=true;
    visibleDrawResult='';
    showStep('draw',true);
    resetDrawVisual();
    drawAnimating=true;
    setDrawStageActive(true);
    document.body.classList.add('draw-focus-mode');

    const wheel=$('#drawWheel'),dart=$('#drawDart');
    requestAnimationFrame(()=>wheel?.classList.add('spinning'));
    setTimeout(()=>dart?.classList.add('hit'),850);

    drawAnimTimer=setTimeout(()=>{
      wheel?.classList.remove('spinning');
      wheel?.classList.add('stopping');
      const final=String(pendingDrawResult||result||data?.lastDraw||data?.firstDrawResult||'').trim();
      visibleDrawResult=final;
      if(markSeen&&final)markDrawSeen();

      setTimeout(()=>{
        document.body.classList.remove('draw-focus-mode');
        wheel?.classList.remove('spinning','stopping');
        dart?.classList.remove('hit');
        setDrawStageActive(false);
        drawAnimating=false;
        pendingDrawResult='';
        drawAnimTimer=null;
        render();
      },1000);
    },1850);
  };

  rebuildDrawChoices();
})();

/* Vote UI v3: icon-only selection feedback, reserved Check.png gutter, Morandi topic palette. */
(()=>{
  const $=s=>document.querySelector(s);
  if(!document.getElementById('choiceVoteV3Styles')){
    const style=document.createElement('style');
    style.id='choiceVoteV3Styles';
    style.textContent=`
:root{--choice-morandi-title:#6f7f8c;--choice-morandi-title-bg:#d9dedf;--choice-morandi-title-border:#c4ced0;--choice-morandi-accent:#829c98}
.room-head-compact{background:rgba(217,222,223,.9)!important;border-color:var(--choice-morandi-title-border)!important}
#roomTitle{color:var(--choice-morandi-title)!important;font-weight:700!important;text-shadow:none!important}
#pollTitleDisplay{color:#7c8e95!important}
#roomDeadlineTop{color:#6f858d!important;background:rgba(205,214,216,.68)!important}
#flowNav button.active{color:#648078!important;border-color:#92aaa5!important;background:#d8e3df!important}
#voteOptions .percent-row{padding-left:86px!important;grid-template-columns:minmax(110px,145px) minmax(0,1fr) 54px!important;column-gap:14px!important}
#voteOptions .vote-option.selected,#voteOptions .vote-option.voted-choice{background:transparent!important;box-shadow:none!important;border-color:transparent!important;outline:0!important}
#voteOptions .vote-option.selected:not(.voted-choice)::before{content:'';position:absolute;left:14px;top:50%;width:62px;height:62px;transform:translateY(-50%);background:url('./assets/stamp/Check.png') center/contain no-repeat;pointer-events:none;z-index:24;filter:drop-shadow(0 5px 8px rgba(72,91,92,.12))}
#voteOptions .vote-option .vote-choice-fx{left:45px!important;top:50%!important;width:68px!important;height:68px!important;transform:translate(-50%,-50%)!important;opacity:1!important;animation:none!important;filter:drop-shadow(0 5px 8px rgba(72,91,92,.12))!important}
#voteOptions .percent-name{color:#657b84!important}
#voteOptions .percent-value{color:#6c858f!important}
@media(max-width:600px){
  #voteOptions .percent-row{padding-left:70px!important;grid-template-columns:minmax(90px,118px) minmax(0,1fr) 46px!important;column-gap:9px!important}
  #voteOptions .vote-option.selected:not(.voted-choice)::before{left:10px;width:52px;height:52px}
  #voteOptions .vote-option .vote-choice-fx{left:36px!important;width:56px!important;height:56px!important}
}
`;
    document.head.appendChild(style);
  }

  function refreshVoteUi(){
    const chatInput=$('#choiceChatInput');
    if(chatInput)chatInput.placeholder='發表你的看法';
  }
  refreshVoteUi();
  new MutationObserver(refreshVoteUi).observe(document.body,{childList:true,subtree:true});
})();
