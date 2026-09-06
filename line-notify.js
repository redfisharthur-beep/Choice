(()=>{
  const $=s=>document.querySelector(s);
  const LINE_URL='https://lin.ee/t5BkC6O';
  const isMobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const showToast=text=>{const el=$('#toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.classList.remove('show'),2200)};
  async function updateLineStatus(){const status=$('#lineConfigStatus');if(!status)return;try{const r=await fetch('/api/line/status',{cache:'no-store'}),j=await r.json();status.textContent=j.configured?'LINE 通知已啟用':'LINE 通知尚未完成設定'}catch{status.textContent='無法確認 LINE 通知狀態'}}
  function currentRoom(){return String($('#roomCodeText')?.textContent||'').trim().toUpperCase()}
  function copyCommand(command){if(!navigator.clipboard?.writeText)return Promise.reject();return navigator.clipboard.writeText(command)}
  const btn=$('#lineReminderBtn');
  if(btn)btn.onclick=()=>{
    const code=currentRoom();if(!/^[A-Z0-9]{6}$/.test(code))return showToast('請先進入房間');
    const command=`綁定 ${code}`;
    $('#lineBindCommand').textContent=command;
    $('#lineReminderDialog').showModal();
    updateLineStatus();
    const open=$('#openLineBindBtn');
    if(open){open.href=LINE_URL;open.textContent=isMobile?'開啟官方 LINE':'顯示官方 LINE QR';open.classList.toggle('hidden',!isMobile)}
    copyCommand(command).then(()=>showToast(isMobile?'綁定指令已複製':'已複製綁定指令，請切換到 LINE 電腦版貼上')).catch(()=>showToast(isMobile?'請複製綁定指令':'請手動複製綁定指令後貼到 LINE 電腦版'));
    if(isMobile){window.location.href=LINE_URL}
  };
  const copy=$('#copyLineBindBtn');if(copy)copy.onclick=async()=>{const text=$('#lineBindCommand')?.textContent||'';try{await copyCommand(text);showToast(isMobile?'綁定指令已複製':'已複製，請切換到 LINE 電腦版貼上')}catch{showToast('請手動複製綁定指令')}};
  const open=$('#openLineBindBtn');if(open){open.href=LINE_URL;if(!isMobile)open.classList.add('hidden')}
})();