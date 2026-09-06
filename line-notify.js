(()=>{
  const $=s=>document.querySelector(s);
  const LINE_URL='https://lin.ee/t5BkC6O';
  const showToast=text=>{const el=$('#toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.classList.remove('show'),2200)};
  async function updateLineStatus(){const status=$('#lineConfigStatus');if(!status)return;try{const r=await fetch('/api/line/status',{cache:'no-store'}),j=await r.json();status.textContent=j.configured?'LINE 通知已啟用':'LINE 通知尚未完成設定'}catch{status.textContent='無法確認 LINE 通知狀態'}}
  function currentRoom(){return String($('#roomCodeText')?.textContent||'').trim().toUpperCase()}
  async function copyCommand(command){
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(command);return}
    const area=document.createElement('textarea');area.value=command;area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
  }
  const btn=$('#lineReminderBtn');
  if(btn)btn.onclick=()=>{
    const code=currentRoom();if(!/^[A-Z0-9]{6}$/.test(code))return showToast('請先進入房間');
    const command=`綁定 ${code}`;
    const commandBox=$('#lineBindCommand');if(commandBox)commandBox.textContent=command;
    const open=$('#openLineBindBtn');if(open)open.href=LINE_URL;
    $('#lineReminderDialog')?.showModal();
    updateLineStatus();
  };
  const copy=$('#copyLineBindBtn');
  if(copy)copy.onclick=async()=>{
    const text=$('#lineBindCommand')?.textContent||'';
    try{await copyCommand(text);showToast('綁定指令已複製，請傳送到 Choice 官方 LINE')}catch{showToast('無法自動複製，請長按綁定指令複製')}
  };
  const open=$('#openLineBindBtn');if(open)open.href=LINE_URL;
})();