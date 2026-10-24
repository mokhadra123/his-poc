# One customer's HIS, as it runs at the hospital. The build context is the
# standalone output of a build composed for that customer from its licence
# (scripts/release.mjs) — never the repository, so nothing else is inside.
FROM node:22-alpine

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    HIS_LICENCE_DIR=/data/licence

WORKDIR /app
COPY --chown=node:node . .
# the licence store: license.json and state.json, kept on the server across upgrades
RUN mkdir -p /data/licence && chown node:node /data/licence

USER node
EXPOSE 3000
VOLUME ["/data/licence"]
CMD ["node", "apps/showcase/server.js"]
