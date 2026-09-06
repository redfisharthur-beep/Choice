window.CHOICE_CONFIG={
  apiBase:"",
  realtimeEnabled:false,
  lineOfficialUrl:"https://lin.ee/t5BkC6O",
  lineCommunityUrl:"https://line.me/ti/g2/k29Jk_pZmJCCqt5jUZjxOLnv8RNnabWLeuFu4Q?utm_source=invitation&utm_medium=link_copy&utm_campaign=default"
};
window.addEventListener('load',()=>{
  if(!document.querySelector('script[data-choice-vote-chat-tweaks]')){
    const s=document.createElement('script');
    s.src='./vote-chat-tweaks.js';
    s.dataset.choiceVoteChatTweaks='1';
    document.body.appendChild(s);
  }
  if(!document.querySelector('script[data-choice-participant-draw-sync]')){
    const s=document.createElement('script');
    s.src='./participant-draw-sync.js';
    s.dataset.choiceParticipantDrawSync='1';
    document.body.appendChild(s);
  }
});
