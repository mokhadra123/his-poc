/*
 * Runs once when a server instance starts. An online installation
 * (HIS_LICENCE_SERVER_URL set) starts its licence heartbeat here; Node only,
 * and never awaited, so the server is ready without waiting on the network.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.HIS_LICENCE_SERVER_URL) return;
  const { startHeartbeat } = await import("./lib/licence-heartbeat");
  startHeartbeat();
}
