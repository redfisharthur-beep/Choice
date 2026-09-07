(()=>{
  const API='/api/rooms';
  const qs=(s,r=document)=>r.querySelector(s);
  const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const getAuthor=room=>String(
    room?.authorName??room?.author??room?.hostName??room?.ownerName??room?.creatorName??room?.createdByName??room?.host?.name??room?.owner?.name??''
  ).trim();

  async function fetchRooms(){
    try{
      const r=await fetch(API,{cache:'no-store'});
      if(!r.ok)return [];
      const j=await r.json();
      return Array.isArray(j?.rooms)?j.rooms:[];
    }catch{return []}
  }

  function useReturnArtwork(){
    const btn=qs('#homeBackBtn');
    if(!btn)return;
    btn.textContent='';
    if(!btn.querySelector('img')){
      const img=document.createElement('img');
      img.src='./assets/hero/return.png';
      img.alt='返回';
      btn.appendChild(img);
    }
  }

  async function decorateRooms(){
    const list=qs('#roomList');
    if(!list)return;
    const rooms=await fetchRooms();
    const byCode=new Map(rooms.map(r=>[String(r?.code||'').toUpperCase(),r]));
    qsa('.room-list-item[data-room-code]',list).forEach((item,index)=>{
      item.classList.add('lobby-room-card');
      item.dataset.tone=String((index%6)+1);
      const code=String(item.dataset.roomCode||'').toUpperCase();
      const room=byCode.get(code)||{};
      let author=qs('.room-list-author',item);
      if(!author){
        author=document.createElement('span');
        author.className='room-list-author';
        item.appendChild(author);
      }
      author.textContent=getAuthor(room)||'房主';
    });
  }

  function bindSearchRefresh(){
    const list=qs('#roomList');
    if(!list)return;
    let timer=0;
    const run=()=>{clearTimeout(timer);timer=setTimeout(decorateRooms,40)};
    new MutationObserver(run).observe(list,{childList:true,subtree:false});
    run();
  }

  function init(){
    useReturnArtwork();
    bindSearchRefresh();
    const back=qs('#homeBackBtn');
    back?.addEventListener('click',()=>setTimeout(()=>window.scrollTo({top:0,left:0,behavior:'instant'}),0));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
