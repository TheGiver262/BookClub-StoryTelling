import { handleRequest } from './router.ts';
import type { Env } from './types.ts';
import { getDatabasePool, closeDatabasePool, withTransaction } from './db/client.ts';
import { expireReservations } from './reservations/service.ts';
import {enforceInternalAccess} from './auth/internal-access.ts';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const denied=await enforceInternalAccess(request,env);
    if(denied) return denied;
    const path = new URL(request.url).pathname;
    if (env.ASSETS && !path.startsWith('/api/') && path !== '/api' && path !== '/health' && !path.startsWith('/health/')) {
      return env.ASSETS.fetch(request);
    }
    // Workers sockets belong to the request that opened them.
    const requestEnv = { ...env };
    try { return await handleRequest(request, requestEnv); }
    finally { await closeDatabasePool(requestEnv); }
  },

  async scheduled(controller: { scheduledTime?: number }, env: Env, _ctx?: { waitUntil?: (p: Promise<any>) => void }): Promise<void> {
    const requestEnv = { ...env };
    try {
      const db = getDatabasePool(requestEnv);
      const now = controller.scheduledTime ? new Date(controller.scheduledTime) : new Date();
      await withTransaction(db, async (tx) => {
        return await expireReservations(tx, now, 100);
      });
    } catch (err) {
      console.error('Lỗi thực thi scheduled task quét đơn đặt hết hạn:', err);
      throw err;
    } finally {
      await closeDatabasePool(requestEnv);
    }
  },
};
