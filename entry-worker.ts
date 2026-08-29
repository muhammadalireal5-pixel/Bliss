// @ts-ignore
import openNextWorker from "./.open-next/worker.js";

export default {
  ...openNextWorker,
  async scheduled(event: any, env: any, ctx: any) {
    ctx.waitUntil((async () => {
      const route = event.cron.includes("*/5") 
        ? "/api/cron/process-queue" 
        : "/api/cron/check-replies";
      
      // Dispatch to internal API route
      await openNextWorker.fetch(
        new Request(`http://internal${route}`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${env.CRON_SECRET}` },
        }), env, ctx
      );
    })());
  },
};
