(()=>{
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  if(!document.getElementById('participantDrawHardFixStyles')){
    const style=document.createElement('style');
    style.id='participantDrawHardFixStyles';
    style.textContent=`
#drawPanel.participant-draw{display:block!important}
#drawPanel.participant-draw #drawHostControls{display:flex!important;flex-direction:column!important;visibility:visible!important;opacity:1!important;min-height:1px!important}
#drawPanel.participant-draw #drawChecks{display:flex!important;flex-direction:column!important;visibility:visible!important;opacity:1!important;width:min(660px,100%)!important;gap:12px!important;margin:0 auto!important}
#drawPanel.participant-draw #drawChecks .draw-check.readonly{display:flex!important;align-items:center!important;width:100%!important;min-height:60px!important;padding:12px 18px!important;margin:0!important;border-radius:18px!important;background:rgba(247,247,242,.92)!important;border:2px solid rgba(107,132,125,.14)!important;color:#526b72!important;font-size:24px!important;line-height:1.4!important;box-sizing:border-box!important}
#drawPanel.participant-draw #drawChecks .draw-check.readonly::before{display:none!important;content:none!important}
#drawPanel.participant-draw #drawChecks .draw-check.readonly input{display:none!important}
#drawPanel.participant-draw #throwBtn{display:none!important}
#drawPanel.participant-draw #drawChecks .draw-check.readonly.draw-hit{background:linear-gradient(105deg,#fff1a8 0%,#b9efd5 35%,#afdfff 68%,#ffd4e3 100%)!important;border-color:#fff!important;color:#244f5b!important;font-weight:1000!important;box-shadow:0 0 0 3px rgba(119,191,224,.55),0 8px 28px rgba(115,204,181,.42),0 0 30px rgba(255,218,105,.5)!important;transform:scale(1.02)!important}
#drawPanel.participant-draw.participant-live-draw #drawChecks{display:flex!important;visibility:visible!important}
#drawPanel.participant-draw.participant-live-draw .draw-stage{display:grid!important;position:relative!important;left:auto!important;top:auto!important;transform:none!important;width:100%!important;min-height:420px!important;place-items:center!important;background:transparent!important;border:0!important;box-shadow:none!important;padding:8px 0!important}
#drawPanel.participant-draw.participant-live-draw .draw-target-wrap{display:grid!important;width:min(390px,74vw)!important;margin:0 auto!important}
body.participant-draw-playing .draw-focus-backdrop{display:none!important}
@media(max-width:600px){
  #drawPanel.participant-draw #drawChecks .draw-check.readonly{font-size:20px!important;min-height:54px!important;padding:10px 14px!important}
  #drawPanel.participant-draw.participant-live-draw .draw-stage{min-height:330px!important}
  #drawPanel.participant-draw.participant-live-draw .draw-target-wrap{width:min(300px,78vw)!important}
}
`;
    document.head.appendChild(style);
  }

  const amHost=()=>{try{return !!isHost}catch{return false}};

  function restoreHostDrawUi(){
    if(!amHost())return false;
    const panel=$('#drawPanel'),controls=$('#drawHostControls'),checks=$('#drawChecks'),throwBtn=$('#throwBtn');
    panel?.classList.remove('participant-draw','participant-live-draw');
    document.body.classList.remove('participant-draw-playing');
    if(controls){controls.style.removeProperty('display');controls.style.removeProperty('visibility');controls.style.removeProperty('opacity')}
    if(checks){delete checks.dataset.participantHtml;checks.style.removeProperty('display');checks.style.removeProperty('visibility');checks.style.removeProperty('opacity')}
    if(throwBtn){
      throwBtn.style.removeProperty('display');
      throwBtn.classList.remove('hidden');
      throwBtn.removeAttribute('aria-hidden');
    }
    return true;
  }

  function resultName(){
    try{return String(visibleDrawResult||data?.lastDraw||data?.firstDrawResult||'').trim()}catch{return ''}
  }

  function rebuildParticipantChoices(){
    if(restoreHostDrawUi())return;
    const panel=$('#drawPanel'),checks=$('#drawChecks');
    if(!panel||!checks)return;
    panel.classList.add('participant-draw');
    const options=(()=>{try{return Array.isArray(data?.options)?data.options:[]}catch{return []}})();
    const hit=resultName();
    const html=options.map(o=>`<div class="draw-check readonly${hit&&String(o.name)===hit?' draw-hit':''}"><span>${esc(o.name)}</span></div>`).join('');
    if(checks.dataset.participantHtml!==html){checks.innerHTML=html;checks.dataset.participantHtml=html}
    const throwBtn=$('#throwBtn');
    if(throwBtn)throwBtn.style.setProperty('display','none','important');
  }

  function installAnimationHook(){
    if(window.__choiceParticipantDrawHardHook)return;
    if(amHost()||typeof playDrawAnimation!=='function')return;
    const previous=playDrawAnimation;
    playDrawAnimation=function(result='',markSeen=false){
      if(amHost()){restoreHostDrawUi();return previous(result,markSeen)}
      if(drawAnimTimer)clearTimeout(drawAnimTimer);
      drawAnimTimer=null;
      if(result)pendingDrawResult=String(result);
      drawAnimating=true;visibleDrawResult='';showStep('draw',true);
      const panel=$('#drawPanel');
      panel?.classList.add('participant-draw','participant-live-draw');
      document.body.classList.remove('draw-focus-mode');document.body.classList.add('participant-draw-playing');
      rebuildParticipantChoices();
      const wheel=$('#drawWheel'),dart=$('#drawDart'),stage=$('.draw-stage'),wrap=$('.draw-target-wrap');
      if(stage){stage.style.setProperty('display','grid','important');stage.style.setProperty('min-height','420px','important')}
      if(wrap)wrap.style.setProperty('display','grid','important');
      wheel?.classList.remove('spinning','stopping');dart?.classList.remove('hit');
      requestAnimationFrame(()=>wheel?.classList.add('spinning'));setTimeout(()=>dart?.classList.add('hit'),850);
      drawAnimTimer=setTimeout(()=>{
        wheel?.classList.remove('spinning');wheel?.classList.add('stopping');
        const final=String(pendingDrawResult||result||data?.lastDraw||data?.firstDrawResult||'').trim();visibleDrawResult=final;
        if(markSeen&&final&&typeof markDrawSeen==='function')markDrawSeen();
        setTimeout(()=>{
          wheel?.classList.remove('spinning','stopping');dart?.classList.remove('hit');
          if(stage){stage.style.setProperty('display','none','important');stage.style.setProperty('min-height','0','important')}
          if(wrap)wrap.style.setProperty('display','none','important');
          panel?.classList.remove('participant-live-draw');document.body.classList.remove('participant-draw-playing');
          drawAnimating=false;pendingDrawResult='';drawAnimTimer=null;rebuildParticipantChoices();
        },1000);
      },1850);
    };
    window.__choiceParticipantDrawHardHook=true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    rebuildParticipantChoices();
    installAnimationHook();
    if(tries>1200)clearInterval(timer);
  },250);
  window.addEventListener('focus',rebuildParticipantChoices);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)rebuildParticipantChoices()});
})();
