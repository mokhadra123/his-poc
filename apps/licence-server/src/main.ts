import { createApp } from "./app.ts";
import { readConfig } from "./config.ts";
import { openDb } from "./db.ts";
import { settleReleases } from "./releases.ts";
import { prepare } from "./setup.ts";

const config = readConfig();
const db = openDb(config.dataDir);
for (const note of prepare(db, config)) console.log(`licence-server: ${note}`);

// a build started before a restart ends with no one listening for it: look every few seconds
setInterval(() => settleReleases(db, config), 5000).unref();

const server = createApp(db, config).listen(config.port, config.host, () => {
  console.log(`licence-server: listening on http://${config.host}:${config.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
