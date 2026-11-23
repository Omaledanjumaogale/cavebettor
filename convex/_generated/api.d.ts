/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as analysis from "../analysis.js";
import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as fixtures from "../fixtures.js";
import type * as http from "../http.js";
import type * as live from "../live.js";
import type * as models from "../models.js";
import type * as paperBets from "../paperBets.js";
import type * as pipeline from "../pipeline.js";
import type * as predictions from "../predictions.js";
import type * as seed from "../seed.js";
import type * as subscriptions from "../subscriptions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  analysis: typeof analysis;
  auth: typeof auth;
  crons: typeof crons;
  fixtures: typeof fixtures;
  http: typeof http;
  live: typeof live;
  models: typeof models;
  paperBets: typeof paperBets;
  pipeline: typeof pipeline;
  predictions: typeof predictions;
  seed: typeof seed;
  subscriptions: typeof subscriptions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
