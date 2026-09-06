import { DurableObject } from 'cloudflare:workers';

const H={'content-type':'application/json;charset=UTF-8','access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS'};
const json=(d,s=200)=>new Response(JSON.stringify(d),{status:s,headers:H});
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(6))).map(n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
const hash=async value=>{if(!value)return '';const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value)));return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')};

export default{
  async fetch(request,env){
    const url=new URL(request.url);if(request.method==='OPTIONS'&&url.pathname.startsWith('/api/'))return new Response(null,{headers:H});
    if(url.pathname==='/api/health')return json({ok:true,service:'choice-realtime'});
    if(url.pathname==='/api/rooms'&&request.method==='POST'){
      const body=await request.json().catch(()=>({}));const room=code(),id=env.CHOICE_ROOMS.idFromName(room),stub=env.CHOICE_ROOMS.get(id);
      await stub.fetch('https://room.local/init',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({state:body.state||{},passwordHash:await hash(body.password||'')})});return json({code:room});
    }
    const m=url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})(\/ws)?$/i);if(m){const id=env.CHOICE_ROOMS.idFromName(m[1].toUpperCase()),stub=env.CHOICE_ROOMS.get(id),forward=new URL(request.url);forward.hostname='room.local';forward.pathname=m[2]?'/ws':'/state';return stub.fetch(new Request(forward,request))}
    if(url.pathname.startsWith('/api/'))return json({error:'Not found'},404);
    return env.ASSETS.fetch(request);
  }
};

export class ChoiceRoom extends DurableObject{
  constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;this.state=null;this.passwordHash=null;this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'))}
  async getState(){if(this.state)return this.state;this.state=await this.ctx.storage.get('roomState')||{title:'未命名主題',options:[],recent:[],lastDraw:null};return this.state}
  async getPasswordHash(){if(this.passwordHash!==null)return this.passwordHash;this.passwordHash=await this.ctx.storage.get('passwordHash')||'';return this.passwordHash}
  async authorized(url){const required=await this.getPasswordHash();if(!required)return true;return (await hash(url.searchParams.get('password')||''))===required}
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/init'&&request.method==='POST'){const body=await request.json().catch(()=>({}));this.state={title:String(body.state?.title||'未命名主題').slice(0,50),options:Array.isArray(body.state?.options)?body.state.options:[],recent:[],lastDraw:null};this.passwordHash=String(body.passwordHash||'');await this.ctx.storage.put({roomState:this.state,passwordHash:this.passwordHash});return json({ok:true})}
    if(url.pathname==='/state'){if(!await this.authorized(url))return json({error:'password required'},401);return json({state:await this.getState(),members:this.members()})}
    if(url.pathname==='/ws'){
      if(request.headers.get('Upgrade')!=='websocket')return new Response('Expected websocket',{status:426});
      if(!await this.authorized(url)){const pair=new WebSocketPair();pair[1].accept();pair[1].close(4001,'password required');return new Response(null,{status:101,webSocket:pair[0]})}
      const pair=new WebSocketPair(),client=pair[0],server=pair[1],clientId=url.searchParams.get('clientId')||crypto.randomUUID(),name=(url.searchParams.get('name')||'訪客').slice(0,30);server.serializeAttachment({clientId,name});this.ctx.acceptWebSocket(server);server.send(JSON.stringify({type:'snapshot',state:await this.getState()}));this.broadcastMembers();return new Response(null,{status:101,webSocket:client})
    }
    return new Response('Not found',{status:404})
  }
  members(){return this.ctx.getWebSockets().map(ws=>{try{return ws.deserializeAttachment()||{name:'訪客'}}catch{return{name:'訪客'}}}).map(x=>({clientId:x.clientId,name:x.name}))}
  broadcast(payload,except=null){const text=JSON.stringify(payload);for(const ws of this.ctx.getWebSockets())if(ws!==except)try{ws.send(text)}catch{}}
  broadcastMembers(){this.broadcast({type:'members',members:this.members()})}
  async webSocketMessage(ws,message){
    let msg;try{msg=JSON.parse(message)}catch{return}
    if(msg.type==='join'){ws.send(JSON.stringify({type:'snapshot',state:await this.getState()}));this.broadcastMembers();return}
    if(msg.type==='state:set'&&msg.state){const s=msg.state;this.state={title:String(s.title||'未命名主題').slice(0,50),options:Array.isArray(s.options)?s.options.slice(0,12).map(o=>({id:String(o.id),name:String(o.name).slice(0,30),votes:Math.max(0,Number(o.votes)||0)})):[],recent:Array.isArray(s.recent)?s.recent.slice(0,5).map(String):[],lastDraw:s.lastDraw?String(s.lastDraw).slice(0,30):null};await this.ctx.storage.put('roomState',this.state);this.broadcast({type:'snapshot',state:this.state},ws);return}
    if(msg.type==='draw'&&msg.name){const who=ws.deserializeAttachment()?.name||'有人';this.broadcast({type:'draw',name:String(msg.name).slice(0,30),by:who},ws);return}
    if(msg.type==='announce'&&msg.result){this.broadcast({type:'announce',result:String(msg.result).slice(0,30)})}
  }
  webSocketClose(){this.broadcastMembers()}webSocketError(){this.broadcastMembers()}
}
