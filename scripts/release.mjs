#!/usr/bin/env node
/*
 * Build one installation's release from its licence: what CI does for every
 * customer release, run by hand or by the licence server's "Build release".
 *
 *   node scripts/release.mjs --licence <file> [options]
 *
 *   --licence <file>            the signed licence (required); it names the customer and installation
 *   --label <text>              the installation's name, for the bundle's name (default: "installation")
 *   --online <url>              an online installation: its heartbeat goes to this licence server URL
 *   --registry <host>           push the image there instead of shipping it as a file
 *   --version <v>               default: <package version>-<UTC yyyymmddhhmm>
 *   --out <dir>                 where the bundle goes (default: releases/)
 *   --port <n>                  the hospital server's port for HIS (default: 8080)
 *   --pull-base                 fetch the newest base image (CI); otherwise a local one is used
 *   --keep-workspace            leave the build copy for inspection
 *
 * Steps, each one stopping the release when it fails:
 *   1. copy     the repository into a temporary workspace — a build never
 *               touches the working tree, where a `next dev` may be running
 *   2. compose  scripts/compose.mjs --licence: only the licensed products
 *   3. build    next build (standalone) of the showcase
 *   4. verify   scripts/verify-build.mjs: no unbought code, routes 200/404
 *   5. image    docker build of the standalone output (apps/showcase/Dockerfile)
 *   6. ship     docker save into the bundle, or docker push to --registry
 *   7. bundle   install.sh, docker-compose.yml, .env, the licence, release.json
 *   8. pack     <bundle>.tar.gz, the one file delivered to the hospital
 *
 * The last line on stdout is `RELEASE_RESULT <json>` (the licence server reads it).
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const fail = (message) => {
  console.error(`release: ${message}`);
  console.log(`RELEASE_RESULT ${JSON.stringify({ ok: false, error: message })}`);
  process.exit(1);
};

/* ---------- inputs ---------- */

const licencePath = opt("--licence");
if (!licencePath || !existsSync(licencePath)) fail("--licence <file> is required and must exist");
const licenceText = readFileSync(licencePath, "utf8");
let licence;
try {
  licence = JSON.parse(licenceText).payload;
} catch {
  fail(`${licencePath} is not a licence file`);
}
if (!licence?.customerId || !licence?.installationId) fail(`${licencePath} has no customer or installation`);

const customerId = licence.customerId;
const label = opt("--label") ?? "installation";
const online = opt("--online") ?? null;
const registry = opt("--registry")?.replace(/\/+$/, "") ?? null;
const port = Number(opt("--port") ?? 8080);
const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
const version = opt("--version") ?? `${JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version ?? "0.1.0"}-${stamp}`;
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(version)) fail(`version "${version}" cannot be an image tag`);
const outDir = resolve(opt("--out") ?? join(root, "releases"));

const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "installation";
const bundleName = `his-${customerId}-${slug(label)}-${version}`;
const imageName = registry ? `${registry}/his-${customerId}:${version}` : `his/${customerId}:${version}`;

/* ---------- running steps ---------- */

let stepNumber = 0;
const step = (title) => console.log(`\n==> [${++stepNumber}/8] ${title}`);

// the parent's own settings must not leak into the build (a licence server URL, a Next dev process,
// `node --watch`, whose dependency reports over IPC break next build's workers …)
function childEnv(extra = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (/^(HIS_|NEXT_|__NEXT|TURBOPACK|NODE_ENV$|PORT$|WATCH_REPORT_DEPENDENCIES$)/.test(key)) continue;
    env[key] = value;
  }
  return { ...env, ...extra };
}

function run(command, commandArgs, { cwd = root, env = childEnv() } = {}) {
  return new Promise((done, reject) => {
    const child = spawn(command, commandArgs, { cwd, env, stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", (error) => reject(new Error(`${command} could not start: ${error.message}`)));
    // the step's title says what failed; the full command is in the log above
    child.on("close", (code) => (code === 0 ? done() : reject(new Error(`${command} ${commandArgs[0]} exited with ${code}`))));
  });
}

function capture(command, commandArgs) {
  return new Promise((done, reject) => {
    let out = "";
    const child = spawn(command, commandArgs, { stdio: ["ignore", "pipe", "inherit"] });
    child.stdout.on("data", (chunk) => (out += chunk));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? done(out.trim()) : reject(new Error(`${command} exited with ${code}`))));
  });
}

const sha256 = (file) =>
  new Promise((done, reject) => {
    const hash = createHash("sha256");
    createReadStream(file).on("data", (chunk) => hash.update(chunk)).on("end", () => done(hash.digest("hex"))).on("error", reject);
  });

/* ---------- the release ---------- */

const workspace = mkdtempSync(join(tmpdir(), "his-release-"));
const ws = join(workspace, "repo");

try {
  step(`Copying the repository into ${ws}`);
  // the source without build output, caches, data or git; node_modules as an APFS clone (instant)
  await run("rsync", [
    "-a",
    "--exclude=.git",
    "--exclude=node_modules",
    "--exclude=.next",
    "--exclude=.licence",
    "--exclude=.data",
    "--exclude=releases",
    "--exclude=.archify",
    "--exclude=*.tsbuildinfo",
    `${root}/`,
    `${ws}/`,
  ]);
  await run("cp", ["-cR", join(root, "node_modules"), join(ws, "node_modules")]).catch(() =>
    run("cp", ["-R", join(root, "node_modules"), join(ws, "node_modules")]),
  );

  step(`Composing "${customerId}" from licence ${licence.licenceId}`);
  const licenceCopy = join(workspace, "license.json");
  writeFileSync(licenceCopy, licenceText);
  await run(process.execPath, [join(ws, "scripts/compose.mjs"), "--licence", licenceCopy], {
    cwd: ws,
    env: childEnv({ HIS_CUSTOMER: customerId }),
  });

  step("Building the standalone app");
  await run("npm", ["run", "build", "-w", "@his/showcase"], { cwd: ws });

  step("Verifying the build holds only what was bought");
  await run(process.execPath, [join(ws, "scripts/verify-build.mjs")], {
    cwd: ws,
    env: childEnv({ HIS_LICENCE_DIR: join(ws, "apps/showcase/.licence") }),
  });

  step(`Building the image ${imageName}`);
  const standalone = join(ws, "apps/showcase/.next/standalone");
  await run("docker", [
    "build",
    // a hospital build must not depend on Docker Hub answering, unless asked to
    ...(args.includes("--pull-base") ? ["--pull"] : []),
    "-t",
    imageName,
    "-f",
    join(ws, "apps/showcase/Dockerfile"),
    "--label",
    `org.his.customer=${customerId}`,
    "--label",
    `org.his.installation=${licence.installationId}`,
    "--label",
    `org.his.licence=${licence.licenceId}`,
    "--label",
    `org.his.version=${version}`,
    standalone,
  ]);
  const imageId = await capture("docker", ["image", "inspect", "--format", "{{.Id}}", imageName]);

  const bundleDir = join(outDir, bundleName);
  rmSync(bundleDir, { recursive: true, force: true });
  mkdirSync(join(bundleDir, "licence"), { recursive: true });

  let imageFile = "";
  let imageSha = "";
  if (registry) {
    step(`Pushing the image to ${registry}`);
    await run("docker", ["push", imageName]);
  } else {
    step("Saving the image into the bundle");
    mkdirSync(join(bundleDir, "image"), { recursive: true });
    const tar = join(workspace, "image.tar");
    await run("docker", ["save", "-o", tar, imageName]);
    imageFile = `image/his-${customerId}-${version}.tar.gz`;
    await pipeline(createReadStream(tar), createGzip({ level: 6 }), createWriteStream(join(bundleDir, imageFile)));
    imageSha = await sha256(join(bundleDir, imageFile));
  }

  step(`Writing the bundle ${bundleName}`);
  writeFileSync(join(bundleDir, "licence/license.json"), licenceText);
  writeFileSync(join(bundleDir, "docker-compose.yml"), composeFile());
  writeFileSync(join(bundleDir, ".env"), envFile());
  writeFileSync(join(bundleDir, "install.sh"), installScript({ imageFile, imageSha }));
  chmodSync(join(bundleDir, "install.sh"), 0o755);
  writeFileSync(join(bundleDir, "README.txt"), readme());
  const manifest = {
    format: "his-release",
    version,
    builtAt: new Date().toISOString(),
    customer: { id: customerId, name: licence.customerName },
    installation: { id: licence.installationId, label, connectivity: online ? "online" : "offline" },
    licence: { id: licence.licenceId, expiresOn: licence.expiresOn, products: licence.products },
    image: { name: imageName, id: imageId, file: imageFile || null, sha256: imageSha || null, registry },
  };
  writeFileSync(join(bundleDir, "release.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  step("Packing the bundle into one file");
  const bundleFile = join(outDir, `${bundleName}.tar.gz`);
  await run("tar", ["-czf", bundleFile, "-C", outDir, bundleName]);
  const bundleSha = await sha256(bundleFile);
  const bytes = statSync(bundleFile).size;

  console.log(`\nrelease: ${bundleName} is ready (${Math.round(bytes / 1024 / 1024)} MB)`);
  console.log(`  bundle  ${bundleFile}`);
  console.log(`  image   ${imageName}${registry ? " (pushed)" : " (in the bundle)"}`);
  console.log(`  install copy ${basename(bundleFile)} to the server, unpack it, run ./install.sh`);
  console.log(`RELEASE_RESULT ${JSON.stringify({ ok: true, version, image: imageName, imageId, bundleDir, bundleFile, bundleSha, bytes })}`);
} catch (error) {
  fail(`Step ${stepNumber} of 8 failed: ${error.message}.`);
} finally {
  if (!args.includes("--keep-workspace")) rmSync(workspace, { recursive: true, force: true });
}

/* ---------- what goes to the hospital ---------- */

function composeFile() {
  return `# HIS for ${licence.customerName.en} · ${label} · ${version} — written by scripts/release.mjs
name: his-${customerId}
services:
  web:
    image: ${imageName}
    restart: unless-stopped
    env_file: .env
    ports:
      - "\${HIS_PORT:-${port}}:3000"
    volumes:
      # the licence store: renewals and the clock high-water mark survive upgrades
      - ./licence:/data/licence
    extra_hosts:
      # lets an online installation reach a licence server on the Docker host (development)
      - "host.docker.internal:host-gateway"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3000/api/licence-status"]
      interval: 30s
      timeout: 5s
      retries: 3
`;
}

function envFile() {
  return [
    `# HIS settings for this installation — written by scripts/release.mjs`,
    `HIS_INSTALLATION_ID=${licence.installationId}`,
    `HIS_LICENCE_DIR=/data/licence`,
    `HIS_VERSION=${version}`,
    `# the port HIS answers on, on this server; install.sh keeps a changed value across upgrades`,
    `HIS_PORT=${port}`,
    ...(online
      ? [`# online: reports to the licence server and receives renewals`, `HIS_LICENCE_SERVER_URL=${online}`, `HIS_HEARTBEAT_SECONDS=3600`]
      : [`# offline: renew by uploading a licence file under Setup → Licence`]),
    "",
  ].join("\n");
}

function installScript({ imageFile, imageSha }) {
  return `#!/usr/bin/env bash
# HIS installer — ${licence.customerName.en} · ${label} · ${version}
# Built ${new Date().toISOString()} from licence ${licence.licenceId}.
#
#   ./install.sh                 installs into /opt/his/${customerId}
#   ./install.sh /srv/his        installs somewhere else
#   HIS_PORT=8090 ./install.sh   answers on another port (with sudo: sudo HIS_PORT=8090 ./install.sh)
#
# Running a newer bundle's install.sh upgrades in place: the licence store
# (renewals, the clock high-water mark) and a changed HIS_PORT are kept.
set -euo pipefail

CUSTOMER="${customerId}"
VERSION="${version}"
IMAGE="${imageName}"
IMAGE_FILE="${imageFile}"
IMAGE_SHA256="${imageSha}"
INSTALLATION_ID="${licence.installationId}"
TARGET="\${1:-/opt/his/$CUSTOMER}"
HERE="$(cd "$(dirname "$0")" && pwd)"

step() { printf '\\n==> %s\\n' "$*"; }
fail() { printf '\\nERROR: %s\\n' "$*" >&2; exit 1; }

step "Checking this server"
command -v docker >/dev/null || fail "Docker is not installed. Install Docker Engine 24 or later first."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 (docker compose) is missing."
docker info >/dev/null 2>&1 || fail "Docker is not running, or this user may not use it (try sudo)."

step "Checking the bundle"
[ -f "$HERE/licence/license.json" ] || fail "licence/license.json is missing from the bundle."
grep -q "\\"installationId\\": \\"$INSTALLATION_ID\\"" "$HERE/licence/license.json" || fail "The licence in this bundle is for another installation."
if [ -n "$IMAGE_FILE" ]; then
  [ -f "$HERE/$IMAGE_FILE" ] || fail "$IMAGE_FILE is missing from the bundle."
  if command -v sha256sum >/dev/null; then SUM=$(sha256sum "$HERE/$IMAGE_FILE" | cut -d' ' -f1); else SUM=$(shasum -a 256 "$HERE/$IMAGE_FILE" | cut -d' ' -f1); fi
  [ "$SUM" = "$IMAGE_SHA256" ] || fail "$IMAGE_FILE is damaged (its checksum does not match). Copy the bundle again."
fi

step "Loading HIS $VERSION"
if [ -n "$IMAGE_FILE" ]; then docker load -i "$HERE/$IMAGE_FILE"; else docker pull "$IMAGE"; fi

step "Installing into $TARGET"
mkdir -p "$TARGET/licence"
cp "$HERE/docker-compose.yml" "$TARGET/docker-compose.yml"
# the port: as asked now, else as installed before, else the bundle's
PORT_LINE=""
if [ -n "\${HIS_PORT:-}" ]; then
  [[ "$HIS_PORT" =~ ^[0-9]{2,5}$ ]] || fail "HIS_PORT must be a port number, not '$HIS_PORT'."
  PORT_LINE="HIS_PORT=$HIS_PORT"
elif [ -f "$TARGET/.env" ]; then PORT_LINE=$(grep '^HIS_PORT=' "$TARGET/.env" || true); fi
cp "$HERE/.env" "$TARGET/.env"
if [ -n "$PORT_LINE" ]; then sed -i.bak "s/^HIS_PORT=.*/$PORT_LINE/" "$TARGET/.env" && rm -f "$TARGET/.env.bak"; fi

issued() { sed -n 's/.*"issuedAt": "\\([^"]*\\)".*/\\1/p' "$1" | head -1; }
if [ ! -f "$TARGET/licence/license.json" ]; then
  cp "$HERE/licence/license.json" "$TARGET/licence/license.json"
  echo "Licence installed."
elif [[ "$(issued "$HERE/licence/license.json")" > "$(issued "$TARGET/licence/license.json")" ]]; then
  cp "$HERE/licence/license.json" "$TARGET/licence/license.json"
  echo "Licence replaced by the newer one in this bundle."
else
  echo "Kept the installed licence: it is the same as, or newer than, this bundle's."
fi
# HIS runs as the image's user node (uid 1000) and writes state.json here
chown -R 1000:1000 "$TARGET/licence" 2>/dev/null || chmod -R a+rwX "$TARGET/licence"

step "Starting HIS"
(cd "$TARGET" && docker compose up -d --remove-orphans)

step "Checking the licence"
STATUS=""
for _ in $(seq 1 60); do
  if STATUS=$(cd "$TARGET" && docker compose exec -T web wget -qO- http://127.0.0.1:3000/api/licence-status 2>/dev/null); then break; fi
  STATUS=""
  sleep 2
done
[ -n "$STATUS" ] || fail "HIS did not answer within 2 minutes. Look at: (cd $TARGET && docker compose logs web)"
echo "$STATUS"
PORT=$(grep '^HIS_PORT=' "$TARGET/.env" | cut -d= -f2)
if echo "$STATUS" | grep -q '"status":"ok"' && echo "$STATUS" | grep -q '"readOnly":false'; then
  step "Done: HIS $VERSION runs on port \${PORT:-${port}} with a valid licence."
else
  step "HIS runs on port \${PORT:-${port}}, but READ-ONLY: install a valid licence under Setup → Licence."
  exit 2
fi
`;
}

function readme() {
  return `HIS ${version} for ${licence.customerName.en} — ${label}
${"=".repeat(60)}

Install on the hospital's server (Linux with Docker Engine 24+ and Docker Compose v2):

  tar -xzf ${bundleName}.tar.gz
  cd ${bundleName}
  sudo ./install.sh              # into /opt/his/${customerId}; or: sudo ./install.sh /srv/his

The installer checks the files, loads HIS, keeps any licence already on the
server unless this bundle's is newer, starts HIS and checks its licence.

HIS answers on port ${port}. Another port: sudo HIS_PORT=8090 ./install.sh
(or change HIS_PORT in the installed .env and run 'docker compose up -d' there).

Licence: products ${licence.products.join(", ") || "core only"}, last valid day ${licence.expiresOn}.
${online ? `Renewals arrive by themselves: this installation reports to ${online}.` : "Offline: install a renewed licence file under Setup → Licence in HIS."}

Upgrading: unpack a newer bundle and run its install.sh the same way.
`;
}
