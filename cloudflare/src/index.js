import { DurableObject } from 'cloudflare:workers';

const H={'content-type':'application/json;charset=UTF-8','access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS'};
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(6))).map(n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
const hash=async value=>{if(!value)return '';const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value)));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')};
const cleanOptions=options=>Array.isArray(options)?options.slice(0,12).map(o=>({id:String(o.id),name:String(o.name).slice(0,30),votes:Math.max(0,Number(o.votes)||0)})):[];

export default{
  async fetch(request,env){
    const url=new URL(request.url);
    try{
      if(request.method==='OPTIONS'&&url.pathname.startsWith('/api/'))return new Response(null,{headers:H});
      if(url.pathname==='/api/health')return json({ok:true,service:'choice-realtime'});
      if(url.pathname==='/api/rooms'&&request.method==='GET'){
        const id=env.CHOICE_ROOMS.idFromName('__CHOICE_DIRECTORY__'),stub=env.CHOICE_ROOMS.get(id);
        try{return await stub.fetch('https://room.local/directory/list')}catch{return json({rooms:[]})}
      }
      if(url.pathname==='/api/rooms'&&request.method==='POST'){
        if(!env.CHOICE_ROOMS)return json({error:'CHOICE_ROOMS binding unavailable'},500);
        const body=await request.json().catch(()=>({}));
        const room=code(),hostToken=crypto.randomUUID(),id=env.CHOICE_ROOMS.idFromName(room),stub=env.CHOICE_ROOMS.get(id),password=String(body.password||''),title=String(body.state?.title||'未命名房間').slice(0,50);
        const initResponse=await stub.fetch('https://room.local/init',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({state:body.state||{},passwordHash:await hash(password),hostToken,createdAt:Date.now()})});
        if(!initResponse.ok){const text=await initResponse.text().catch(()=>'');return json({error:text||'Room initialization failed'},500)}
        try{
          const dir=env.CHOICE_ROOMS.get(env.CHOICE_ROOMS.idFromName('__CHOICE_DIRECTORY__'));
          await dir.fetch('https://room.local/directory/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:room,title,locked:!!password,createdAt:Date.now()})});
        }catch(err){console.error('directory register failed',err)}
        return json({ok:true,code:room,hostToken});
      }
      const m=url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})(\/ws)?$/i);
      if(m){
        const id=env.CHOICE_ROOMS.idFromName(m[1].toUpperCase()),stub=env.CHOICE_ROOMS.get(id),forward=new URL(request.url);
        forward.hostname='room.local';forward.pathname=m[2]?'/ws':'/state';return stub.fetch(new Request(forward,request));
      }
      if(url.pathname.startsWith('/api/'))return json({error:'Not found'},404);
      return env.ASSETS.fetch(request);
    }catch(err){
      console.error('choice worker error',err);
      return json({error:err?.message||'Worker error'},500);
    }
  }
};

export class ChoiceRoom extends DurableObject{
  constructor(ctx,env){
    super(ctx,env);this.ctx=ctx;this.env=env;this.state=null;this.passwordHash=null;this.hostToken=null;this.ballots=null;this.initialized=null;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
  }
  async isInitialized(){if(this.initialized!==null)return this.initialized;this.initialized=!!(await this.ctx.storage.get('initialized'));return this.initialized}
  async getState(){if(this.state)return this.state;this.state=await this.ctx.storage.get('roomState')||{title:'未命名主題',options:[],recent:[],lastDraw:null,phase:'setup'};if(!this.state.phase)this.state.phase='setup';return this.state}
  async getPasswordHash(){if(this.passwordHash!==null)return this.passwordHash;this.passwordHash=await this.ctx.storage.get('passwordHash')||'';return this.passwordHash}
  async getHostToken(){if(this.hostToken!==null)return this.hostToken;this.hostToken=await this.ctx.storage.get('hostToken')||'';return this.hostToken}
  async getBallots(){if(this.ballots)return this.ballots;this.ballots=await this.ctx.storage.get('ballots')||{};return this.ballots}
  async authorized(url){const required=await this.getPasswordHash();if(!required)return true;return (await hash(url.searchParams.get('password')||''))===required}
  async isHostUrl(url){const token=await this.getHostToken();return !!token&&url.searchParams.get('hostToken')===token}
  attachment(ws){try{return ws.deserializeAttachment()||{clientId:'',name:'訪客',isHost:false}}catch{return{clientId:'',name:'訪客',isHost:false}}}
  async sendSnapshot(ws){const a=this.attachment(ws),ballots=await this.getBallots();try{ws.send(JSON.stringify({type:'snapshot',state:await this.getState(),isHost:!!a.isHost,myVote:ballots[a.clientId]||null}))}catch{}}
  async broadcastState(){for(const ws of this.ctx.getWebSockets())await this.sendSnapshot(ws)}
  async persistState(){await this.ctx.storage.put('roomState',this.state)}
  async resetVotes(){const s=await this.getState();this.ballots={};s.options=s.options.map(o=>({...o,votes:0}));await this.ctx.storage.put('ballots',this.ballots);await this.persistState()}
  async recomputeVotes(){const s=await this.getState(),ballots=await this.getBallots(),counts={};for(const id of Object.values(ballots))counts[id]=(counts[id]||0)+1;s.options=s.options.map(o=>({...o,votes:counts[o.id]||0}));await this.persistState()}
  async fetch(request){
    const url=new URL(request.url);
    try{
      if(url.pathname==='/directory/list'){
        const now=Date.now(),maxAge=6*60*60*1000;let rooms=await this.ctx.storage.get('directoryRooms')||[];rooms=rooms.filter(r=>now-Number(r.createdAt||0)<maxAge).slice(0,30);await this.ctx.storage.put('directoryRooms',rooms);return json({rooms});
      }
      if(url.pathname==='/directory/register'&&request.method==='POST'){
        const body=await request.json().catch(()=>({}));let rooms=await this.ctx.storage.get('directoryRooms')||[];
        const item={code:String(body.code||'').slice(0,6).toUpperCase(),title:String(body.title||'未命名房間').slice(0,50),locked:!!body.locked,createdAt:Number(body.createdAt)||Date.now()};
        rooms=[item,...rooms.filter(r=>r.code!==item.code)].slice(0,50);await this.ctx.storage.put('directoryRooms',rooms);return json({ok:true});
      }
      if(url.pathname==='/directory/remove'&&request.method==='POST'){
        const body=await request.json().catch(()=>({}));let rooms=await this.ctx.storage.get('directoryRooms')||[];const c=String(body.code||'').toUpperCase();rooms=rooms.filter(r=>r.code!==c);await this.ctx.storage.put('directoryRooms',rooms);return json({ok:true});
      }
      if(url.pathname==='/init'&&request.method==='POST'){
        const body=await request.json().catch(()=>({}));this.state={title:String(body.state?.title||'未命名主題').slice(0,50),options:cleanOptions(body.state?.options),recent:[],lastDraw:null,phase:'setup'};this.passwordHash=String(body.passwordHash||'');this.hostToken=String(body.hostToken||'');this.ballots={};this.initialized=true;
        await this.ctx.storage.put({roomState:this.state,passwordHash:this.passwordHash,hostToken:this.hostToken,ballots:this.ballots,initialized:true,createdAt:Number(body.createdAt)||Date.now()});return json({ok:true});
      }
      if(url.pathname==='/state'){
        if(!await this.isInitialized())return json({error:'room not found'},404);
        if(!await this.authorized(url))return json({error:'password required'},401);
        return json({state:await this.getState(),members:this.members()});
      }
      if(url.pathname==='/ws'){
        if(request.headers.get('Upgrade')!=='websocket')return new Response('Expected websocket',{status:426});
        if(!await this.isInitialized()){
          const pair=new WebSocketPair();pair[1].accept();pair[1].send(JSON.stringify({type:'error',message:'房間不存在或已失效'}));pair[1].close(4004,'room not found');return new Response(null,{status:101,webSocket:pair[0]});
        }
        if(!await this.authorized(url)){const pair=new WebSocketPair();pair[1].accept();pair[1].close(4001,'password required');return new Response(null,{status:101,webSocket:pair[0]})}
        const pair=new WebSocketPair(),client=pair[0],server=pair[1],clientId=url.searchParams.get('clientId')||crypto.randomUUID(),name=(url.searchParams.get('name')||'訪客').slice(0,30),isHost=await this.isHostUrl(url);
        server.serializeAttachment({clientId,name,isHost});this.ctx.acceptWebSocket(server);await this.sendSnapshot(server);this.broadcastMembers();return new Response(null,{status:101,webSocket:client});
      }
      return json({error:'Not found'},404);
    }catch(err){console.error('choice room error',err);return json({error:err?.message||'Room error'},500)}
  }
  members(){return this.ctx.getWebSockets().map(ws=>this.attachment(ws)).map(x=>({clientId:x.clientId,name:x.name,isHost:!!x.isHost}))}
  broadcast(payload,except=null){const text=JSON.stringify(payload);for(const ws of this.ctx.getWebSockets())if(ws!==except)try{ws.send(text)}catch{}}
  broadcastMembers(){this.broadcast({type:'members',members:this.members()})}
  async webSocketMessage(ws,message){
    let msg;try{msg=JSON.parse(message)}catch{return}const a=this.attachment(ws),s=await this.getState();
    if(msg.type==='join'){await this.sendSnapshot(ws);this.broadcastMembers();return}
    if(msg.type==='state:set'){
      if(!a.isHost||s.phase!=='setup')return ws.send(JSON.stringify({type:'error',message:'只有房主可在設定階段修改內容'}));
      const next=msg.state||{},oldIds=s.options.map(o=>o.id).join('|'),newOptions=cleanOptions(next.options),newIds=newOptions.map(o=>o.id).join('|');
      s.title=String(next.title||'未命名主題').slice(0,50);s.options=newOptions.map(o=>({...o,votes:0}));s.lastDraw=null;s.recent=[];this.state=s;
      if(oldIds!==newIds){this.ballots={};await this.ctx.storage.put('ballots',this.ballots)}await this.persistState();await this.broadcastState();return;
    }
    if(msg.type==='phase'){
      if(!a.isHost)return ws.send(JSON.stringify({type:'error',message:'只有房主可以控制流程'}));
      const phase=String(msg.phase||'');if(!['setup','voting','closed','draw'].includes(phase))return;
      if(phase==='voting'){if(s.options.length<2)return ws.send(JSON.stringify({type:'error',message:'至少需要 2 個項目'}));s.phase='voting';this.state=s;await this.resetVotes()}
      else{s.phase=phase;this.state=s;await this.persistState()}
      await this.broadcastState();return;
    }
    if(msg.type==='vote'){
      if(s.phase!=='voting')return ws.send(JSON.stringify({type:'error',message:'目前沒有開放投票'}));
      const optionId=String(msg.optionId||'');if(!s.options.some(o=>o.id===optionId))return;
      const ballots=await this.getBallots();ballots[a.clientId]=optionId;this.ballots=ballots;await this.ctx.storage.put('ballots',ballots);await this.recomputeVotes();await this.broadcastState();ws.send(JSON.stringify({type:'vote:ack',optionId}));return;
    }
    if(msg.type==='draw:request'){
      if(!a.isHost)return ws.send(JSON.stringify({type:'error',message:'只有房主可以抽籤'}));
      const ids=Array.isArray(msg.optionIds)?msg.optionIds.map(String):[],pool=s.options.filter(o=>ids.includes(o.id));if(pool.length<2)return ws.send(JSON.stringify({type:'error',message:'至少勾選 2 個項目'}));
      const r=crypto.getRandomValues(new Uint32Array(1))[0],pick=pool[r%pool.length];s.lastDraw=pick.name;s.recent=[pick.name,...(s.recent||[])].slice(0,5);s.phase='draw';this.state=s;await this.persistState();await this.broadcastState();this.broadcast({type:'draw',name:pick.name,by:a.name});return;
    }
    if(msg.type==='announce'&&msg.result){if(!a.isHost)return ws.send(JSON.stringify({type:'error',message:'只有房主可以公告結果'}));const result=String(msg.result).slice(0,30);this.broadcast({type:'announce',result});return}
  }
  webSocketClose(){this.broadcastMembers()}
  webSocketError(){this.broadcastMembers()}
}
