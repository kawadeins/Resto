// Metro config for pnpm monorepo — see https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");
const Module = require("module");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

// ─── pnpm isolated-linker workaround ─────────────────────────────────────────
// @expo/metro-config calls:
//   require.resolve('expo-asset/tools/hashAssetFiles', { paths: [projectRoot] })
//
// On EAS Build, pnpm's isolated linker may not hoist expo-asset into a
// location that Node's require.resolve can find from projectRoot.
// We patch Module._resolveFilename to also search:
//  1. The workspace's own node_modules (symlinks pnpm creates)
//  2. The monorepo root's node_modules (hoisted packages)
//  3. The pnpm virtual store directly (.pnpm/expo-asset@*/)
// This guarantees expo-asset is found regardless of the linker mode.
(function patchExpoAssetResolution() {
  const orig = Module._resolveFilename.bind(Module);

  const searchPaths = [
    path.resolve(projectRoot, "node_modules"),
    path.resolve(monorepoRoot, "node_modules"),
  ];

  // Scan pnpm virtual store (.pnpm/) for expo-asset — works with any linker mode
  const pnpmStore = path.join(monorepoRoot, "node_modules", ".pnpm");
  try {
    const entry = fs.readdirSync(pnpmStore).find((d) => d.startsWith("expo-asset@"));
    if (entry) {
      searchPaths.push(path.join(pnpmStore, entry, "node_modules"));
    }
  } catch (_) {}

  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request.startsWith("expo-asset")) {
      try {
        return orig(request, parent, isMain, {
          ...options,
          paths: [...searchPaths, ...((options && options.paths) || [])],
        });
      } catch (_) {}
    }
    return orig(request, parent, isMain, options);
  };
})();
// ─────────────────────────────────────────────────────────────────────────────

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
