import { spawn } from "node:child_process";

const SNAP_GUI_VARIABLES = [
  "GDK_PIXBUF_MODULEDIR",
  "GDK_PIXBUF_MODULE_FILE",
  "GIO_EXTRA_MODULES",
  "GIO_MODULE_DIR",
  "GSETTINGS_SCHEMA_DIR",
  "GTK_EXE_PREFIX",
  "GTK_IM_MODULE_FILE",
  "GTK_PATH",
  "LOCPATH",
];

const SNAP_PATH_LIST_VARIABLES = [
  "GI_TYPELIB_PATH",
  "GST_PLUGIN_PATH",
  "GST_PLUGIN_PATH_1_0",
  "GST_PLUGIN_SCANNER",
  "GST_PLUGIN_SCANNER_1_0",
  "GST_PLUGIN_SYSTEM_PATH",
  "GST_PLUGIN_SYSTEM_PATH_1_0",
  "LD_LIBRARY_PATH",
  "LIBRARY_PATH",
  "XDG_DATA_DIRS",
];

function isSnapPath(value, snapRoots) {
  return (
    value === "/snap" ||
    value.startsWith("/snap/") ||
    snapRoots.some((root) => value === root || value.startsWith(`${root}/`))
  );
}

function sanitizeSnapEnvironment(source) {
  const env = { ...source, __NV_DISABLE_EXPLICIT_SYNC: "1" };

  if (process.platform !== "linux" || !env.SNAP) {
    return { env, sanitized: false };
  }

  const snapRoots = [
    env.SNAP,
    env.SNAP_COMMON,
    env.SNAP_DATA,
    env.SNAP_USER_COMMON,
    env.SNAP_USER_DATA,
  ].filter(Boolean);

  for (const key of SNAP_GUI_VARIABLES) {
    delete env[key];
  }

  for (const key of SNAP_PATH_LIST_VARIABLES) {
    const value = env[key];
    if (!value) continue;

    const hostPaths = value
      .split(":")
      .filter(Boolean)
      .filter((entry) => !isSnapPath(entry, snapRoots));

    if (hostPaths.length > 0) {
      env[key] = hostPaths.join(":");
    } else {
      delete env[key];
    }
  }

  for (const key of Object.keys(env)) {
    if (key === "SNAP" || key.startsWith("SNAP_")) {
      delete env[key];
    }
  }

  // Keep XDG_DATA_HOME unchanged so existing DataTeX databases remain in the
  // same location. Only library/plugin discovery paths are sanitized here.
  return { env, sanitized: true };
}

const { env, sanitized } = sanitizeSnapEnvironment(process.env);
if (sanitized) {
  console.warn(
    "[DataTeX] Snap-hosted terminal detected; using host GTK/GStreamer libraries for Tauri.",
  );
}

const tauriArgs = ["exec", "tauri", ...process.argv.slice(2)];
const packageManagerEntrypoint = process.env.npm_execpath;
const command = packageManagerEntrypoint
  ? process.execPath
  : process.platform === "win32"
    ? "pnpm.cmd"
    : "pnpm";
const commandArgs = packageManagerEntrypoint
  ? [packageManagerEntrypoint, ...tauriArgs]
  : tauriArgs;

const child = spawn(command, commandArgs, {
  env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.once("error", (error) => {
  console.error(`[DataTeX] Could not start the Tauri CLI: ${error.message}`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
