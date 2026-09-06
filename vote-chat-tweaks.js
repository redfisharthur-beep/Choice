(()=>{
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const style=document.createElement('style');
  style.id='choiceVoteChatTweaks';
  style.textContent=`
/* Vote layout: Check.png at far left, wrapping option text, no gap between bar and percent */
#voteOptions{overflow:visible!important}
#voteOptions .percent-row{
  position:relative!important;
  padding-left:76px!important;
  padding-right:0!important;
  grid-template-columns:minmax(120px,180px) minmax(0,1fr) max-content!important;
  column-gap:0!important;
  row-gap:4px!important;
  min-height:58px!important;
  overflow:visible!important;
}
#voteOptions .percent-name{
  white-space:normal!important;
  overflow:visible!important;
  text-overflow:clip!important;
  overflow-wrap:anywhere!important;
  word-break:break-word!important;
  line-height:1.45!important;
  padding-right:12px!important;
  min-width:0!important;
}
#voteOptions .percent-track{width:100%!important;max-width:none!important;margin:0!important}
#voteOptions .percent-value{margin:0!important;padding:0!important;min-width:42px!important;text-align:right!important}
#voteOptions .vote-option.selected,#voteOptions .vote-option.voted-choice{
  background:transparent!important;
  border-color:transparent!important;
  box-shadow:none!important;
  outline:0!important;
}
#voteOptions .vote-option.selected:not(.voted-choice)::before{
  content:''!important;
  position:absolute!important;
  left:0!important;
  top:50%!important;
  width:64px!important;
  height:64px!important;
  transform:translateY(-50%)!important;
  background:url('./assets/stamp/Check.png') center/contain no-repeat!important;
  pointer-events:none!important;
  z-index:40!important;
  filter:drop-shadow(0 5px 8px rgba(72,91,92,.12))!important;
}
#voteOptions .vote-option .vote-choice-fx{
  left:32px!important;
  top:50%!important;
  width:64px!important;
  height:64px!important;
  transform:translate(-50%,-50%)!important;
  opacity:1!important;
  animation:none!important;
  filter:drop-shadow(0 5px 8px rgba(72,91,92,.12))!important;
}

/* Chat: same IP = same Morandi color, different IPs get different palette slots */
.choice-chat-list{gap:10px!important}
.choice-chat-msg{border-left:5px solid transparent!important;transition:none!important}
.choice-chat-msg b{font-weight:900!important}
.choice-chat-msg.tone-0{background:#e8d9d5!important;border-left-color:#b88f86!important;color:#745f5a!important}.choice-chat-msg.tone-0 b{color:#6f514a!important}
.choice-chat-msg.tone-1{background:#dbe4df!important;border-left-color:#8ba79a!important;color:#587068!important}.choice-chat-msg.tone-1 b{color:#466158!important}
.choice-chat-msg.tone-2{background:#dde2e9!important;border-left-color:#8fa0b5!important;color:#586676!important}.choice-chat-msg.tone-2 b{color:#47566a!important}
.choice-chat-msg.tone-3{background:#e7e0d3!important;border-left-color:#b4a184!important;color:#746957!important}.choice-chat-msg.tone-3 b{color:#655946!important}
.choice-chat-msg.tone-4{background:#e4dce5!important;border-left-color:#aa92ad!important;color:#705f72!important}.choice-chat-msg.tone-4 b{color:#624f65!important}
.choice-chat-msg.tone-5{background:#d9e5e6!important;border-left-color:#86a9ad!important;color:#557074!important}.choice-chat-msg.tone-5 b{color:#426167!important}
.choice-chat-msg.tone-6{background:#e5ded8!important;border-left-color:#ae9787!important;color:#725f54!important}.choice-chat-msg.tone-6 b{color:#634f44!important}
.choice-chat-msg.tone-7{background:#dfe4d8!important;border-left-color:#98a985!important;color:#627056!important}.choice-chat-msg.tone-7 b{color:#536247!important}

@media(max-width:600px){
  #voteOptions .percent-row{
    padding-left:60px!important;
    grid-template-columns:minmax(92px,124px) minmax(0,1fr) max-content!important;
    min-height:54px!important;
  }
  #voteOptions .percent-name{padding-right:8px!important;line-height:1.4!important}
  #voteOptions .vote-option.selected:not(.voted-choice)::before{left:0!important;width:50px!important;height:50px!important}
  #voteOptions .vote-option .vote-choice-fx{left:25px!important;width:50px!important;height:50px!important}
  #voteOptions .percent-value{min-width:36px!important}
}
`;
  document.head.appendChild(style);

  function toneForMessage(m){
    const n=Number(m?.tone);
    if(Number.isFinite(n))return ((Math.trunc(n)%8)+8)%8;
    const seed=String(m?.name||'訪客');
    let h=0;for(let i=0;i<seed.length;i++)h=(h*31+seed.charCodeAt(i))>>>0;
    return h%8;
  }

  function installChatRenderer(){
    if(typeof renderChat!=='function'||typeof ensureChatUi!=='function')return false;
    renderChat=function(){
      ensureChatUi();
      const list=$('#choiceChatList');
      if(!list)return;
      const stick=list.scrollHeight-list.scrollTop-list.clientHeight<60;
      list.innerHTML=Array.isArray(chatMessages)&&chatMessages.length?chatMessages.map(m=>{
        const d=new Date(Number(m.at)||Date.now());
        const t=Number.isNaN(d.getTime())?'':d.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'});
        const tone=toneForMessage(m);
        return `<div class="choice-chat-msg tone-${tone}"><span class="choice-chat-time">${esc(t)}</span><b>${esc(m.name||'訪客')}</b>${esc(m.text||'')}</div>`;
      }).join(''):'';
      const input=$('#choiceChatInput');if(input)input.placeholder='發表你的看法';
      if(stick)requestAnimationFrame(()=>{list.scrollTop=list.scrollHeight});
    };
    renderChat();
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(installChatRenderer()||tries>40)clearInterval(timer);
  },100);
})();
