import resetWorker,{ChoiceRoom as BaseChoiceRoom} from './reset-entry.js';

const chatTone=value=>{
  const s=String(value||'');
  let h=2166136261>>>0;
  for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;
  return h%8;
};

export class ChoiceRoom extends BaseChoiceRoom{
  async webSocketMessage(ws,message){
    let msg=null;try{msg=JSON.parse(message)}catch{}
    if(msg?.type==='chat'){
      const a=this.attachment(ws);
      const text=String(msg.text||'').trim().replace(/\s+/g,' ').slice(0,300);
      if(!text)return;
      let list=await this.getChatMessages();
      const item={
        id:crypto.randomUUID(),
        name:String(a.name||'訪客').slice(0,20),
        text,
        at:Date.now(),
        tone:chatTone(a.voterKey||a.clientId)
      };
      list=[...list,item].slice(-100);
      this.chatMessages=list;
      await this.ctx.storage.put('chatMessages',list);
      this.broadcast({type:'chat',message:item});
      return;
    }
    return super.webSocketMessage(ws,message);
  }
}

export default resetWorker;
