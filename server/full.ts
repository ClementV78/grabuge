import site from 'vinext/server/fetch-handler';
import game from './worker';
export { GameRoom, RoomRegistry } from './worker';
export default {
  async fetch(request:Request,env:any,ctx:ExecutionContext){
    if(new URL(request.url).pathname.startsWith('/api/rooms'))return game.fetch(request,env);
    return site.fetch(request,env,ctx);
  }
};
