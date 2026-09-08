import baseWorker,{ChoiceRoom as BaseChoiceRoom} from './index.js';

const enc=new TextEncoder();
const dec=new TextDecoder();
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=UTF-8','cache-control':'no-store',...headers}});
const base64Url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const fromBase64Url=value=>{const normalized=String(value||'').replace(/-/g,'+').replace(/_/g,'/');const padded=normalized+'='.repeat((4-normalized.length%4)%4);return Uint8Array.from(atob(padded),c=>c.charCodeAt(0))};
const randomHex=(bytes=24)=>[...crypto.getRandomValues(new Uint8Array(bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
const randomVerifier=()=>base64Url(crypto.getRandomValues(new Uint8Array(48)));
const sha256=async value=>base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(String(value)))));
const hmac=async(secret,value)=>{const key=await crypto.subtle.importKey('raw',enc.encode(String(secret)),{name:'HMAC',hash:'SHA-256'},false,['sign']);return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(String(value))))) };
const safeEqual=(a,b)=>{a=String(a||'');b=String(b||'');if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0};
const signPayload=async(payload,secret)=>{const body=base64Url(enc.encode(JSON.stringify(payload)));return `${body}.${await hmac(secret,body)}`};
const verifyPayload=async(token,secret)=>{try{const [body,sig,...rest]=String(token||'').split('.');if(!body||!sig||rest.length)return null;const expected=await hmac(secret,body);if(!safeEqual(sig,expected))return null;return JSON.parse(dec.decode(fromBase64Url(body)))}catch{return null}};
const parseCookies=request=>{try{return Object.fromEntries(String(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).filter(Boolean).map(v=>{const i=v.indexOf('=');return i<0?[v,'']:[v.slice(0,i),decodeURIComponent(v.slice(i+1))]}))}catch{return {}}};
const cookie=(name,value,maxAge)=>`${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure; HttpOnly`;
const clearCookie=name=>`${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly`;
const redirect=(location,cookies=[])=>{const headers=new Headers({'location':location,'cache-control':'no-store'});for(const value of cookies)headers.append('set-cookie',value);return new Response(null,{status:302,headers})};
const sessionSecret=env=>env.LINE_LOGIN_SESSION_SECRET||env.LINE_LOGIN_CHANNEL_SECRET||'';
const configured=env=>!!(env.LINE_LOGIN_CHANNEL_ID&&env.LINE_LOGIN_CHANNEL_SECRET);
const DEFAULT_VOTE_WINDOW_MS=7*24*60*60*1000;
const ROOM_LIST_RESET_AT=1788851460000;
const GENDERS=['男','女','跨性別'];
const AGES=['20歲以下','20-35歲','35-50歲','50-65歲'];
const REGIONS=['北部地區','中部地區','南部地區','東部地區','外島'];
const cleanProfile=value=>{const p=value||{},gender=String(p.gender||''),age=String(p.age||''),region=String(p.region||'');return {gender:GENDERS.includes(gender)?gender:'',age:AGES.includes(age)?age:'',region:REGIONS.includes(region)?region:''}};
const profileComplete=p=>!!(p&&p.gender&&p.age&&p.region);
const chatTone=value=>{
  const s=String(value||'');
  let h=2166136261>>>0;
  for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;
  return h%8;
};

function voteOutcome(state){
  const options=Array.isArray(state?.options)?state.options:[];
  const max=options.reduce((m,o)=>Math.max(m,Math.max(0,Number(o?.votes)||0)),0);
  const winners=max>0?options.filter(o=>(Number(o?.votes)||0)===max):[];
  return {max,winners};
}

function finalVoteResult(state){
  const {max,winners}=voteOutcome(state);
  if(max<=0||!winners.length)return '本次投票無人投票';
  const names=winners.map(o=>String(o?.name||'').trim()).filter(Boolean);
  if(!names.length)return '本次投票無人投票';
  return names.length===1?`${names[0]}（${max} 票）`:`${names.join('、')}（同票 ${max} 票）`;
}

async function getMessagingBotInfo(env){
  const token=String(env.LINE_CHANNEL_ACCESS_TOKEN||'');
  if(!token)return {ok:false,status:503,data:{configured:false,error:'LINE_CHANNEL_ACCESS_TOKEN missing'}};
  try{
    const r=await fetch('https://api.line.me/v2/bot/info',{headers:{authorization:`Bearer ${token}`}});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)return {ok:false,status:r.status,data:{configured:true,tokenValid:false,error:data.message||'LINE bot info failed'}};
    return {ok:true,status:200,data:{configured:true,tokenValid:true,basicId:String(data.basicId||data.premiumId||''),displayName:String(data.displayName||''),pictureUrl:String(data.pictureUrl||'')}};
  }catch(err){return {ok:false,status:502,data:{configured:true,tokenValid:false,error:err?.message||'LINE bot info failed'}}}
}

async function handleLineAuth(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(!path.startsWith('/api/auth/'))return null;
  const secret=sessionSecret(env),cookies=parseCookies(request);

  if(path==='/api/auth/line/status'&&request.method==='GET')return json({configured:configured(env)});

  if(path==='/api/auth/me'&&request.method==='GET'){
    if(!secret)return json({authenticated:false});
    const session=await verifyPayload(cookies.choice_line_session,secret);
    if(!session||Number(session.exp||0)<Date.now())return json({authenticated:false},200,{'set-cookie':clearCookie('choice_line_session')});
    return json({authenticated:true,user:{userId:session.userId,displayName:session.displayName,pictureUrl:session.pictureUrl||''}});
  }

  if(path==='/api/auth/logout'&&(request.method==='POST'||request.method==='GET'))return json({ok:true},200,{'set-cookie':clearCookie('choice_line_session')});

  if(path==='/api/auth/line/start'&&request.method==='GET'){
    if(!configured(env))return json({error:'LINE Login 尚未設定'},503);
    const state=randomHex(24),nonce=randomHex(24),verifier=randomVerifier(),challenge=await sha256(verifier),redirectUri=`${url.origin}/api/auth/line/callback`;
    const oauth=await signPayload({state,nonce,verifier,iat:Date.now()},secret);
    const auth=new URL('https://access.line.me/oauth2/v2.1/authorize');
    auth.searchParams.set('response_type','code');
    auth.searchParams.set('client_id',env.LINE_LOGIN_CHANNEL_ID);
    auth.searchParams.set('redirect_uri',redirectUri);
    auth.searchParams.set('state',state);
    auth.searchParams.set('scope','profile openid');
    auth.searchParams.set('nonce',nonce);
    auth.searchParams.set('code_challenge',challenge);
    auth.searchParams.set('code_challenge_method','S256');
    return redirect(auth.toString(),[cookie('choice_line_oauth',oauth,600)]);
  }

  if(path==='/api/auth/line/callback'&&request.method==='GET'){
    const fail=reason=>redirect(`/?line_login=${encodeURIComponent(reason)}`,[clearCookie('choice_line_oauth')]);
    if(!configured(env))return fail('not_configured');
    if(url.searchParams.get('error'))return fail('cancelled');
    const code=url.searchParams.get('code')||'',state=url.searchParams.get('state')||'';
    const oauth=await verifyPayload(cookies.choice_line_oauth,secret);
    if(!oauth||!code||!state||oauth.state!==state||Date.now()-Number(oauth.iat||0)>10*60*1000)return fail('invalid_state');
    const redirectUri=`${url.origin}/api/auth/line/callback`;
    const form=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:redirectUri,client_id:env.LINE_LOGIN_CHANNEL_ID,client_secret:env.LINE_LOGIN_CHANNEL_SECRET,code_verifier:oauth.verifier});
    const tokenRes=await fetch('https://api.line.me/oauth2/v2.1/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form});
    const token=await tokenRes.json().catch(()=>({}));
    if(!tokenRes.ok||!token.access_token)return fail('token_error');

    let verified=null;
    if(token.id_token){
      const verifyForm=new URLSearchParams({id_token:token.id_token,client_id:env.LINE_LOGIN_CHANNEL_ID,nonce:oauth.nonce});
      const verifyRes=await fetch('https://api.line.me/oauth2/v2.1/verify',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:verifyForm});
      verified=await verifyRes.json().catch(()=>null);
      if(!verifyRes.ok||!verified?.sub)return fail('verify_error');
    }

    const profileRes=await fetch('https://api.line.me/v2/profile',{headers:{authorization:`Bearer ${token.access_token}`}});
    const profile=await profileRes.json().catch(()=>({}));
    if(!profileRes.ok||!profile.userId||!profile.displayName)return fail('profile_error');
    if(verified?.sub&&verified.sub!==profile.userId)return fail('profile_mismatch');

    const now=Date.now(),session=await signPayload({userId:String(profile.userId),displayName:String(profile.displayName).slice(0,50),pictureUrl:String(profile.pictureUrl||''),iat:now,exp:now+30*24*60*60*1000},secret);
    return redirect('/?line_login=success',[clearCookie('choice_line_oauth'),cookie('choice_line_session',session,30*24*60*60)]);
  }

  return json({error:'Not found'},404);
}

export class ChoiceRoom extends BaseChoiceRoom{
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==='/ws'){
      const profile=cleanProfile({gender:url.searchParams.get('gender'),age:url.searchParams.get('age'),region:url.searchParams.get('region')});
      if(!profileComplete(profile)){
        const pair=new WebSocketPair();
        pair[1].accept();
        pair[1].send(JSON.stringify({type:'error',message:'請先完成性別、年齡與地區設定'}));
        pair[1].close(4006,'profile required');
        return new Response(null,{status:101,webSocket:pair[0]});
      }
      const voterKey=request.headers.get('x-choice-voter-key')||url.searchParams.get('clientId')||'';
      if(!this.pendingProfiles)this.pendingProfiles=new Map();
      this.pendingProfiles.set(String(voterKey),profile);
    }
    return super.fetch(request);
  }

  async upsertParticipant(voterKey,name,isHost=false){
    const key=String(voterKey||'');if(!key)return;
    const records=await this.getParticipantRecords(),old=records[key]||{},profile=this.pendingProfiles?.get(key)||cleanProfile(old.profile||{});
    records[key]={name:String(name||old.name||'訪客').slice(0,20),isHost:!!(isHost||old.isHost),joinedAt:Number(old.joinedAt)||Date.now(),profile:profileComplete(profile)?profile:(old.profile||null)};
    this.participantRecords=records;
    await this.ctx.storage.put('participantRecords',records);
  }

  async analyticsSnapshot(){
    const s=await this.getState(),options=Array.isArray(s.options)?s.options:[],records=await this.getParticipantRecords(),ballots=await this.getBallots();
    const dimensions={gender:GENDERS,age:AGES,region:REGIONS};
    const counts={gender:{},age:{},region:{}};
    for(const [dim,labels] of Object.entries(dimensions))for(const label of labels)counts[dim][label]={};
    let profiledVotes=0;
    for(const [key,value] of Object.entries(ballots)){
      const profile=cleanProfile(records[key]?.profile||{});if(!profileComplete(profile))continue;
      for(const optionId of this.ballotList(value)){
        if(!options.some(o=>String(o.id)===String(optionId)))continue;
        profiledVotes++;
        for(const dim of Object.keys(dimensions)){const label=profile[dim];counts[dim][label][optionId]=(counts[dim][label][optionId]||0)+1}
      }
    }
    const groups={};
    for(const [dim,labels] of Object.entries(dimensions))groups[dim]=labels.map(label=>{
      const row=counts[dim][label]||{},total=Object.values(row).reduce((a,b)=>a+b,0),choices=options.map(o=>{const count=row[o.id]||0;return {id:o.id,name:o.name,count,percent:total?Math.round(count/total*1000)/10:0}});
      const max=choices.reduce((m,c)=>Math.max(m,c.count),0),top=max>0?choices.filter(c=>c.count===max).map(c=>c.name):[];
      return {label,total,top,choices};
    });
    const byOption=options.map(o=>{
      const leaders={};
      for(const [dim,labels] of Object.entries(dimensions)){
        const values=labels.map(label=>({label,count:counts[dim][label]?.[o.id]||0})),max=values.reduce((m,x)=>Math.max(m,x.count),0);
        leaders[dim]={count:max,labels:max>0?values.filter(x=>x.count===max).map(x=>x.label):[]};
      }
      return {id:o.id,name:o.name,votes:Number(o.votes)||0,leaders};
    });
    return {profiledVotes,totalVotes:options.reduce((a,o)=>a+(Number(o.votes)||0),0),byOption,groups};
  }

  async sendSnapshot(ws){
    const a=this.attachment(ws),ballots=await this.getBallots(),mine=this.ballotList(ballots[a.voterKey||a.clientId]);
    try{ws.send(JSON.stringify({type:'snapshot',state:await this.getState(),isHost:!!a.isHost,myVote:mine.at(-1)||null,votesUsed:mine.length,members:await this.memberSnapshot(),chat:await this.getChatMessages(),analytics:await this.analyticsSnapshot()}))}catch{}
  }

  async webSocketMessage(ws,message){
    let msg=null;try{msg=JSON.parse(message)}catch{}
    if(!msg)return;

    if(msg.type==='chat'){
      const a=this.attachment(ws);
      const text=String(msg.text||'').trim().replace(/\s+/g,' ').slice(0,300);
      if(!text)return;
      let list=await this.getChatMessages();
      const item={id:crypto.randomUUID(),name:String(a.name||'訪客').slice(0,20),text,at:Date.now(),tone:chatTone(a.voterKey||a.clientId)};
      list=[...list,item].slice(-100);this.chatMessages=list;await this.ctx.storage.put('chatMessages',list);this.broadcast({type:'chat',message:item});return;
    }

    if(msg.type==='room:close'){
      try{ws.send(JSON.stringify({type:'error',message:'房間會持續保留，可使用左下離開按鈕回首頁'}))}catch{}
      return;
    }

    let s=await this.getState();
    const a=this.attachment(ws);

    if(msg.type==='state:set'&&s.phase==='setup'){
      s.firstDrawResult=null;s.firstDrawAt=null;s.firstDrawOptionIds=[];this.state=s;await this.persistState();
    }

    if(msg.type==='phase'&&msg.phase==='voting'){
      if(s.phase!=='setup'){try{ws.send(JSON.stringify({type:'error',message:'目前流程不能重新開始投票'}))}catch{}return}
      if(!s.voteDeadline)s.voteDeadline=new Date(Date.now()+DEFAULT_VOTE_WINDOW_MS).toISOString();
      s.voteFinalizedAt=null;s.voteTieIds=[];s.firstDrawResult=null;s.firstDrawAt=null;s.firstDrawOptionIds=[];this.state=s;await this.persistState();
      return super.webSocketMessage(ws,JSON.stringify(msg));
    }

    if(s.phase==='voting'&&msg.type==='phase'&&['setup','closed'].includes(String(msg.phase||''))){
      if(!this.voteExpired(s)){try{ws.send(JSON.stringify({type:'error',message:'投票截止前不能提前結算'}))}catch{}return}
      await this.closeVotingForDeadline();return;
    }

    if(msg.type==='phase'&&msg.phase==='draw'){
      if(s.phase==='voting')return;
      if(s.phase==='setup'||s.phase==='closed'||s.phase==='draw')return;
      try{ws.send(JSON.stringify({type:'error',message:'目前不能進行抽籤'}))}catch{}
      return;
    }

    if(msg.type==='draw:request'){
      if(!a.isHost){try{ws.send(JSON.stringify({type:'error',message:'只有房主可以抽籤'}))}catch{}return}
      s=await this.getState();
      if(!['setup','voting','closed','draw'].includes(s.phase)){try{ws.send(JSON.stringify({type:'error',message:'目前不能進行抽籤'}))}catch{}return}
      const ids=Array.isArray(msg.optionIds)?msg.optionIds.map(String):[],pool=(Array.isArray(s.options)?s.options:[]).filter(o=>ids.includes(String(o.id)));
      if(pool.length<2){try{ws.send(JSON.stringify({type:'error',message:'至少勾選 2 個項目'}))}catch{}return}
      const official=!String(s.firstDrawResult||'').trim();
      this.broadcast({type:'draw:start',optionIds:ids,by:a.name,official});
      await new Promise(resolve=>setTimeout(resolve,850));
      const r=crypto.getRandomValues(new Uint32Array(1))[0],pick=pool[r%pool.length];
      s.lastDraw=pick.name;s.recent=[pick.name,...(s.recent||[])].slice(0,5);
      if(official){s.firstDrawResult=pick.name;s.firstDrawAt=Date.now();s.firstDrawOptionIds=ids}
      this.state=s;await this.persistState();
      this.broadcast({type:'draw',name:pick.name,optionIds:ids,by:a.name,official,firstDrawResult:s.firstDrawResult||null});
      await this.broadcastState();
      return;
    }

    if(msg.type==='announce'){
      s=await this.getState();
      if(s.phase==='voting'){if(this.voteExpired(s))await this.closeVotingForDeadline();try{ws.send(JSON.stringify({type:'error',message:'投票結果會在截止時間由系統自動公告'}))}catch{}return}
      if(s.voteFinalizedAt&&s.phase!=='draw'){try{ws.send(JSON.stringify({type:'error',message:'投票結果已由系統自動公告'}))}catch{}return}
      if(s.phase==='draw')return;
    }

    return super.webSocketMessage(ws,JSON.stringify(msg));
  }

  async closeVotingForDeadline(){
    const s=await this.getState();
    if(s.phase!=='voting'||!this.voteExpired(s))return false;
    const {winners}=voteOutcome(s);
    s.phase='closed';s.voteFinalizedAt=Date.now();s.voteTieIds=winners.length>1?winners.map(o=>String(o.id)):[];this.state=s;
    await this.persistState();await this.broadcastState();
    const result=finalVoteResult(s);
    this.broadcast({type:'announce',result,automatic:true,tie:s.voteTieIds.length>1});
    await this.notifyLineSubscribers(`投票結果：${result}`);
    return true;
  }

  async alarm(){await this.closeVotingForDeadline()}
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/api/line/bot-info'&&request.method==='GET'){
      const info=await getMessagingBotInfo(env);return json(info.data,info.status);
    }
    const auth=await handleLineAuth(request,env);if(auth)return auth;
    if(url.pathname==='/api/rooms'&&request.method==='GET'){
      const response=await baseWorker.fetch(request,env,ctx);if(!response.ok)return response;
      const data=await response.clone().json().catch(()=>null);if(!data||!Array.isArray(data.rooms))return response;
      const rooms=data.rooms.filter(room=>Number(room?.createdAt||0)>=ROOM_LIST_RESET_AT);return json({...data,rooms},response.status);
    }
    return baseWorker.fetch(request,env,ctx);
  }
};