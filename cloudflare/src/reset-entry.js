import baseWorker,{ChoiceRoom} from './entry.js';

export {ChoiceRoom};

// Clear the visible room directory for a fresh test cycle.
// Rooms created before this fixed cutoff stay in Durable Object storage,
// but they are no longer returned by the public room list.
const ROOM_LIST_RESET_AT=1788691747000;

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/api/rooms'&&request.method==='GET'){
      const response=await baseWorker.fetch(request,env,ctx);
      if(!response.ok)return response;
      const data=await response.clone().json().catch(()=>null);
      if(!data||!Array.isArray(data.rooms))return response;
      const rooms=data.rooms.filter(room=>Number(room?.createdAt||0)>=ROOM_LIST_RESET_AT);
      return new Response(JSON.stringify({...data,rooms}),{
        status:response.status,
        headers:{
          'content-type':'application/json;charset=UTF-8',
          'cache-control':'no-store'
        }
      });
    }
    return baseWorker.fetch(request,env,ctx);
  }
};
