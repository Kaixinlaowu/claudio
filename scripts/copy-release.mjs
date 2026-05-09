import { cpSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const RELEASE_DIR = join(ROOT, "release");

mkdirSync(RELEASE_DIR, { recursive: true });

const platform = process.argv[2];
if (!platform) {
  console.error("Usage: node scripts/copy-release.mjs <windows|android>");
  process.exit(1);
}

if (platform === "windows") {
  const srcTarget = join(ROOT, "src-tauri", "target", "release");
  const appExe = join(srcTarget, "app.exe");
  if (existsSync(appExe)) {
    cpSync(appExe, join(RELEASE_DIR, "app.exe"));
    console.log("Copied app.exe");
  } else {
    console.warn("app.exe not found at", appExe);
  }

  const nsisDir = join(srcTarget, "bundle", "nsis");
  if (existsSync(nsisDir)) {
    for (const f of readdirSync(nsisDir)) {
      if (f.endsWith(".exe")) {
        cpSync(join(nsisDir, f), join(RELEASE_DIR, f));
        console.log(`Copied ${f}`);
      }
    }
  }
} else if (platform === "android") {
  const apkDir = join(
    ROOT,
    "src-tauri",
    "gen",
    "android",
    "app",
    "build",
    "outputs",
    "apk",
    "universal",
    "release"
  );
  if (existsSync(apkDir)) {
    for (const f of readdirSync(apkDir)) {
      if (f.endsWith(".apk")) {
        cpSync(join(apkDir, f), join(RELEASE_DIR, f));
        console.log(`Copied ${f}`);
      }
    }
  } else {
    console.warn("APK output directory not found at", apkDir);
  }
} else {
  console.error(`Unknown platform: ${platform}`);
  process.exit(1);
}
