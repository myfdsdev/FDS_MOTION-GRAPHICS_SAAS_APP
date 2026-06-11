/**
 * Shared Remotion bundler override.
 *
 * The backend package.json declares "type": "module", which makes webpack
 * (Remotion's bundler) treat every .js/.jsx file as strict ESM and REQUIRE
 * fully-specified imports — i.e. './text/TextReveal.jsx' instead of
 * './text/TextReveal'. The generated component registry uses extensionless
 * imports, so the bundle fails with "Can't resolve … fully specified".
 *
 * Setting `resolve.fullySpecified = false` for JS/JSX modules restores the
 * usual extensionless resolution, matching how Vite resolves the same files
 * in the editor preview. This is the standard webpack fix for this error.
 */
export function webpackOverride(config) {
  config.module = config.module || {};
  config.module.rules = config.module.rules || [];
  config.module.rules.push({
    test: /\.m?jsx?$/,
    resolve: { fullySpecified: false },
  });
  return config;
}
