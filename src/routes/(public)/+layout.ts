/**
 * The public marketing surface is pre-rendered into static HTML so that a
 * visitor never needs a Worker invocation to read it. Nothing in this route
 * group may read cookies, call Convex or touch platform.env.
 */
export const prerender = true;
export const trailingSlash = 'never';
