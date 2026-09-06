import { DurableObject } from 'cloudflare:workers';

const JSON_HEADERS={'content-type':'application/json;charset=UTF-8','access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const roomCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(6))).map(n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method==='OPTIONS')return new Response(null,{headers:JSON_HEADERS});
    if(url.pathname==='/api/health')return json({ok:true,service:'choice-realtime'});
    if(url.pathname==='/api/rooms'&&request.method==='POST'){
      const body=await request.json().catch(()=>({}));
      const code=roomCode();
      const id=env.CHOICE_ROOMS.idFromName(code);
      const stub=env.CHOICE_ROOMS.get(id);
      await stub.fetch('https://room.local/init',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      return json({code});
    }
    const match=url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})(\/ws)?$/i);
    if(match){
      const code=match[1].toUpperCase();
      const id=env.CHOICE_ROOMS.idFromName(code);
      const stub=env.CHOICE_ROOMS.get(id);
      const forward=new URL(request.url);forward.hostname='room.local';forward.pathname=match[2]?'/ws':'/state';
      return stub.fetch(new Request(forward,request));
    }
    if(url.pathname==='/api/auth/line/start'){
      if(!env.LINE_CHANNEL_ID||!env.LINE_CALLBACK_URL)return json({error:'LINE Login not configured'},503);
      const state=crypto.randomUUID();
      const auth=new URL('https://access.line.me/oauth2/v2.1/authorize');
      auth.searchParams.set('response_type','code');auth.searchParams.set('client_id',env.LINE_CHANNEL_ID);auth.searchParams.set('redirect_uri',env.LINE_CALLBACK_URL);auth.searchParams.set('state',state);auth.searchParams.set('scope','profile openid');
      return Response.redirect(auth.href,302);
    }
    return json({error:'Not found'},404);
  }
};

export class ChoiceRoom extends DurableObject{
  constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;this.state=null;this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'))}
  async getState(){
    if(this.state)return this.state;
    this.state=await this.ctx.storage.get('roomState')||{title:'未命名主題',options:[],recent:[]};return this.state;
  }
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/init'&&request.method==='POST'){
      const body=await request.json().catch(()=>({}));this.state=body.state||{title:'未命名主題',options:[],recent:[]};await this.ctx.storage.put('roomState',this.state);return json({ok:true});
    }
    if(url.pathname==='/state')return json({state:await this.getState(),members:this.members()});
    if(url.pathname==='/ws'){
      if(request.headers.get('Upgrade')!=='websocket')return new Response('Expected websocket',{status:426});
      const pair=new WebSocketPair(),client=pair[0],server=pair[1];
      const clientId=url.searchParams.get('clientId')||crypto.randomUUID(),name=(url.searchParams.get('name')||'訪客').slice(0,30);
      server.serializeAttachment({clientId,name});this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({type:'snapshot',state:await this.getState()}));this.broadcastMembers();
      return new Response(null,{status:101,webSocket:client});
    }
    return new Response('Not found',{status:404});
  }
  members(){return this.ctx.getWebSockets().map(ws=>{try{return ws.deserializeAttachment()||{name:'訪客'}}catch{return{name:'訪客'}}}).map(x=>({clientId:x.clientId,name:x.name}))}
  broadcast(payload,except=null){const text=JSON.stringify(payload);for(const ws of this.ctx.getWebSockets())if(ws!==except)try{ws.send(text)}catch{}}
  broadcastMembers(){this.broadcast({type:'members',members:this.members()})}
  async webSocketMessage(ws,message){
    let msg;try{msg=JSON.parse(message)}catch{return}
    if(msg.type==='join'){ws.send(JSON.stringify({type:'snapshot',state:await this.getState()}));this.broadcastMembers();return}
    if(msg.type==='state:set'&&msg.state){
      const next=msg.state;this.state={title:String(next.title||'未命名主題').slice(0,50),options:Array.isArray(next.options)?next.options.slice(0,12).map(o=>({id:String(o.id),name:String(o.name).slice(0,30),votes:Math.max(0,Number(o.votes)||0)})):[],recent:Array.isArray(next.recent)?next.recent.slice(0,5).map(String):[]};
      await this.ctx.storage.put('roomState',this.state);this.broadcast({type:'snapshot',state:this.state},ws);return;
    }
    if(msg.type==='draw'&&msg.name){const who=ws.deserializeAttachment()?.name||'有人';this.broadcast({type:'draw',name:String(msg.name).slice(0,30),by:who},ws)}
  }
  webSocketClose(){this.broadcastMembers()}
  webSocketError(){this.broadcastMembers()}
}
