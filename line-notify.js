(()=>{
  const $=s=>document.querySelector(s);
  const LINE_URL='https://lin.ee/t5BkC6O';
  const showToast=text=>{const el=$('#toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.classList.remove('show'),1800)};
  async function updateLineStatus(){const status=$('#lineConfigStatus');if(!status)return;try{const r=await fetch('/api/line/status',{cache:'no-store'}),j=await r.json();status.textContent=j.configured?'LINE 通知已啟用':'LINE 通知尚未完成設定'}catch{status.textContent='無法確認 LINE 通知狀態'}}
  function currentRoom(){return String($('#roomCodeText')?.textContent||'').trim().toUpperCase()}
  function openOfficialLine(){
    const a=document.createElement('a');
    a.href=LINE_URL;
    a.target='_blank';
    a.rel='noopener noreferrer';
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  const btn=$('#lineReminderBtn');
  if(btn)btn.onclick=()=>{
    const code=currentRoom();if(!/^[A-Z0-9]{6}$/.test(code))return showToast('請先進入房間');
    const command=`綁定 ${code}`;
    $('#lineBindCommand').textContent=command;
    $('#lineReminderDialog').showModal();
    updateLineStatus();
    if(navigator.clipboard?.writeText)navigator.clipboard.writeText(command).then(()=>showToast('綁定指令已複製')).catch(()=>{});
    openOfficialLine();
  };
  const copy=$('#copyLineBindBtn');if(copy)copy.onclick=async()=>{const text=$('#lineBindCommand')?.textContent||'';try{await navigator.clipboard.writeText(text);showToast('綁定指令已複製')}catch{showToast('請手動複製綁定指令')}};
  const open=$('#openLineBindBtn');if(open)open.href=LINE_URL;
})();