(()=>{
  const $=s=>document.querySelector(s);
  const showToast=text=>{const el=$('#toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.classList.remove('show'),1800)};
  async function updateLineStatus(){const status=$('#lineConfigStatus');if(!status)return;try{const r=await fetch('/api/line/status',{cache:'no-store'}),j=await r.json();status.textContent=j.configured?'LINE 通知已啟用':'LINE 通知尚未完成設定'}catch{status.textContent='無法確認 LINE 通知狀態'}}
  function currentRoom(){return String($('#roomCodeText')?.textContent||'').trim().toUpperCase()}
  const btn=$('#lineReminderBtn');if(btn)btn.onclick=()=>{const code=currentRoom();if(!/^[A-Z0-9]{6}$/.test(code))return showToast('請先進入房間');$('#lineBindCommand').textContent=`綁定 ${code}`;updateLineStatus();$('#lineReminderDialog').showModal()};
  const copy=$('#copyLineBindBtn');if(copy)copy.onclick=async()=>{const text=$('#lineBindCommand')?.textContent||'';try{await navigator.clipboard.writeText(text);showToast('綁定指令已複製')}catch{showToast('請手動複製綁定指令')}};
})();