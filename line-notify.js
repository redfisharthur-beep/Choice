(()=>{
  const $=s=>document.querySelector(s);
  const LINE_URL='https://lin.ee/t5BkC6O';
  const showToast=text=>{const el=$('#toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(showToast.t);showToast.t=setTimeout(()=>el.classList.remove('show'),2200)};
  const currentRoom=()=>String($('#roomCodeText')?.textContent||'').trim().toUpperCase();
  const copyCommand=command=>navigator.clipboard?.writeText?navigator.clipboard.writeText(command):Promise.reject();
  const btn=$('#lineReminderBtn');
  if(btn)btn.onclick=()=>{const code=currentRoom();if(!/^[A-Z0-9]{6}$/.test(code))return showToast('請先進入房間');const command=`綁定 ${code}`;const hidden=$('#lineBindCommand');if(hidden)hidden.textContent=command;$('#lineReminderDialog')?.showModal()};
  const copy=$('#copyLineBindBtn');
  if(copy)copy.onclick=async()=>{const text=$('#lineBindCommand')?.textContent||'';try{await copyCommand(text);showToast('綁定指令已複製，請傳送到官方 LINE')}catch{showToast('請允許瀏覽器使用剪貼簿')}};
  const open=$('#openLineBindBtn');if(open)open.href=LINE_URL;
})();