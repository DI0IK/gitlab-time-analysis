export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmCache } = await import("./app/api/cache");

    // Eagerly warm the cache on launch
    warmCache();

    // Schedule background updates once every hour
    setInterval(() => {
      console.log("[Scheduler] Triggering hourly background cache refresh...");
      warmCache();
    }, 60 * 60 * 1000);
  }
}
