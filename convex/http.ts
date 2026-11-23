import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { api } from './_generated/api';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

const http = httpRouter();

http.route({
  path: '/health',
  method: 'GET',
  handler: httpAction(async () => new Response(JSON.stringify({ status: 'ok', service: 'cavebettor-convex', time: Date.now() }), { headers: cors }))
});

http.route({
  path: '/fixtures',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const sportKey = url.searchParams.get('sport') ?? undefined;
    const status = url.searchParams.get('status') ?? undefined;
    const fixtures = await ctx.runQuery(api.fixtures.list, {
      sportKey: sportKey && sportKey !== 'all' ? sportKey : undefined,
      status: status === 'live' || status === 'scheduled' || status === 'finished' || status === 'halftime' || status === 'postponed' ? status : undefined,
      limit: Number(url.searchParams.get('limit') ?? 50)
    });
    return new Response(JSON.stringify({ count: fixtures.length, fixtures }), { headers: cors });
  })
});

http.route({
  path: '/value',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const sportKey = url.searchParams.get('sport') ?? undefined;
    const rows = await ctx.runQuery(api.predictions.board, {
      sportKey: sportKey && sportKey !== 'all' ? sportKey : undefined,
      limit: Number(url.searchParams.get('limit') ?? 40)
    });
    return new Response(JSON.stringify({ count: rows.length, selections: rows }), { headers: cors });
  })
});

http.route({
  path: '/models',
  method: 'GET',
  handler: httpAction(async (ctx) => {
    const models = await ctx.runQuery(api.models.list, {});
    return new Response(JSON.stringify({ count: models.length, models }), { headers: cors });
  })
});

export default http;
