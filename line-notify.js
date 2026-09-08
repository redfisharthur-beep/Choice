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

  async function messagingReady(){return !!(await getBotInfo()).ok}

  async function openOfficialLine(ev){
    ev?.preventDefault?.();
    const info=await getBotInfo();
    if(!info.ok){showToast('LINE 官方帳號尚未連線完成');location.href=FALLBACK_LINE_URL;return}
    const id=info.basicId,appUrl=`line://ti/p/${id}`,webUrl=`https://line.me/R/ti/p/${encodeURIComponent(id)}`;
    let hidden=false;
    document.addEventListener('visibilitychange',()=>{if(document.hidden)hidden=true},{once:true});
    location.href=appUrl;
    setTimeout(()=>{if(!hidden&&document.visibilityState==='visible')location.href=webUrl},1200);
  }

  const btn=$('#lineReminderBtn');
  if(btn)btn.onclick=async()=>{
    const code=currentRoom();
    if(!/^[A-Z0-9]{6}$/.test(code))return showToast('請先進入房間');
    if(!await messagingReady())return showToast('LINE 通知後台尚未完成，請檢查 Messaging API 設定');
    const command=`綁定 ${code}`;
    const hidden=$('#lineBindCommand');if(hidden)hidden.textContent=command;
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
  if(open){open.href='#';open.onclick=openOfficialLine}
})();
