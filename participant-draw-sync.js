(()=>{
  const $=s=>document.querySelector(s);

  if(!document.getElementById('participantDrawSyncStyles')){
    const style=document.createElement('style');
    style.id='participantDrawSyncStyles';
    style.textContent=`
/* Participant draw view: always show choices, no checkbox controls, sync target animation */
#drawPanel.participant-draw #drawHostControls{display:flex!important;visibility:visible!important}
#drawPanel.participant-draw #throwBtn{display:none!important}
#drawPanel.participant-draw #drawChecks{display:flex!important;visibility:visible!important}
#drawPanel.participant-draw #drawChecks .draw-check.readonly{display:flex!important;width:100%!important;padding:12px 18px!important;background:rgba(247,247,242,.92)!important;border:2px solid rgba(107,132,125,.14)!important;border-radius:18px!important;color:#526b72!important;font-size:24px!important;line-height:1.35!important;box-shadow:none!important}
#drawPanel.participant-draw #drawChecks .draw-check.readonly::before{display:none!important;content:none!important}
#drawPanel.participant-draw #drawChecks .draw-check.readonly input{display:none!important}
#drawPanel.participant-draw #drawChecks .draw-check.readonly.draw-hit{background:linear-gradient(105deg,#fff1a8 0%,#b9efd5 35%,#afdfff 68%,#ffd4e3 100%)!important;border-color:#fff!important;color:#244f5b!important;font-weight:1000!important;transform:scale(1.02)!important;box-shadow:0 0 0 3px rgba(119,191,224,.55),0 8px 28px rgba(115,204,181,.42),0 0 30px rgba(255,218,105,.5)!important}
#drawPanel.participant-draw.participant-live-draw #drawHostControls{display:flex!important;visibility:visible!important}
#drawPanel.participant-draw.participant-live-draw #drawChecks{display:flex!important;visibility:visible!important}
#drawPanel.participant-draw.participant-live-draw .draw-stage{position:relative!important;left:auto!important;top:auto!important;transform:none!important;width:100%!important;min-height:420px!important;display:grid!important;place-items:center!important;background:transparent!important;border:0!important;box-shadow:none!important;padding:8px 0!important;z-index:auto!important}
#drawPanel.participant-draw.participant-live-draw .draw-target-wrap{display:grid!important;width:min(390px,74vw)!important;margin:0 auto!important}
body.participant-draw-playing .draw-focus-backdrop{display:none!important}
body.participant-draw-playing #drawHostControls{visibility:visible!important}
@media(max-width:600px){
  #drawPanel.participant-draw #drawChecks .draw-check.readonly{font-size:20px!important;padding:10px 14px!important;border-radius:16px!important}
  #drawPanel.participant-draw.participant-live-draw .draw-stage{min-height:330px!important}
  #drawPanel.participant-draw.participant-live-draw .draw-target-wrap{width:min(300px,78vw)!important}
}
`;
    document.head.appendChild(style);
  }

  const oldSetDrawStageActive=typeof setDrawStageActive==='function'?setDrawStageActive:null;
  setDrawStageActive=function(active){
    const wrap=$('.draw-target-wrap'),stage=$('.draw-stage');
    if(wrap)wrap.style.setProperty('display',active?'grid':'none','important');
    if(stage){
      stage.style.setProperty('display',active?'grid':'none','important');
      stage.style.setProperty('min-height',active?'500px':'0px','important');
    }
  };

  const previousPlay=typeof playDrawAnimation==='function'?playDrawAnimation:null;
  if(previousPlay){
    playDrawAnimation=function(result='',markSeen=false){
      if(isHost)return previousPlay(result,markSeen);

      if(drawAnimTimer)clearTimeout(drawAnimTimer);
      drawAnimTimer=null;
      if(result)pendingDrawResult=String(result);
      drawAnimating=true;
      visibleDrawResult='';
      showStep('draw',true);

      const panel=$('#drawPanel');
      panel?.classList.add('participant-live-draw');
      document.body.classList.remove('draw-focus-mode');
      document.body.classList.add('participant-draw-playing');

      const wheel=$('#drawWheel'),dart=$('#drawDart');
      wheel?.classList.remove('spinning','stopping');
      dart?.classList.remove('hit');
      setDrawStageActive(true);

      requestAnimationFrame(()=>wheel?.classList.add('spinning'));
      setTimeout(()=>dart?.classList.add('hit'),850);

      drawAnimTimer=setTimeout(()=>{
        wheel?.classList.remove('spinning');
        wheel?.classList.add('stopping');
        const final=String(pendingDrawResult||result||data?.lastDraw||data?.firstDrawResult||'').trim();
        visibleDrawResult=final;
        if(markSeen&&final)markDrawSeen();

        setTimeout(()=>{
          wheel?.classList.remove('spinning','stopping');
          dart?.classList.remove('hit');
          setDrawStageActive(false);
          panel?.classList.remove('participant-live-draw');
          document.body.classList.remove('participant-draw-playing');
          drawAnimating=false;
          pendingDrawResult='';
          drawAnimTimer=null;
          render();
        },1000);
      },1850);
    };
  }

  function refreshParticipantDraw(){
    const panel=$('#drawPanel');
    if(!panel)return;
    if(!isHost)panel.classList.add('participant-draw');
    const throwBtn=$('#throwBtn');
    if(throwBtn&&!isHost)throwBtn.classList.add('hidden');
    if(!drawAnimating)setDrawStageActive(false);
  }

  const oldRender=typeof render==='function'?render:null;
  if(oldRender){
    render=function(){
      oldRender();
      refreshParticipantDraw();
    };
  }
  refreshParticipantDraw();
})();
