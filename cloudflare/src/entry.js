import baseWorker,{ChoiceRoom} from './index.js';

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

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/api/line/bot-info'&&request.method==='GET'){
      const info=await getMessagingBotInfo(env);
      return json(info.data,info.status);
    }
    const auth=await handleLineAuth(request,env);
    if(auth)return auth;
    return baseWorker.fetch(request,env,ctx);
  }
};

export {ChoiceRoom};
