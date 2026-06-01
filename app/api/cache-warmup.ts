function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

let warming = false;

// Start warming immediately when this module is loaded in the App Router scope.
// NOT called from instrumentation.ts — that runs in a separate module context.
function startWarming() {
  // Skip during `next build` — static generation workers should not make
  // GitLab network requests.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  queueMicrotask(() => {
    warmCache().catch(() => {});
  });

  // Schedule hourly background refresh
  setInterval(() => {
    console.log("[Scheduler] Triggering hourly background cache refresh...");
    warmCache().catch(() => {});
  }, 60 * 60 * 1000);
}

startWarming();

export async function warmCache() {
  if (warming) {
    console.log("[Cache] Warming already in progress, skipping...");
    return;
  }
  warming = true;
  console.log("[Cache] Starting eager cache warming...");
  try {
    const { getDescendantGroups } = await import("./cache-descendant-groups");
    const { data: groups } = await getDescendantGroups();
    console.log(`[Cache] Found ${groups.length} groups to warm.`);

    const { getMembers } = await import("./cache-members");
    const { getTimelogs } = await import("./cache-timelogs");
    const { getLabels } = await import("./cache-labels");
    const { getMergeRequests } = await import("./cache-merge-requests");

    for (const batch of chunk(groups, 3)) {
      await Promise.all(
        batch.map(async (group) => {
          console.log(`[Cache] Warming data for group: ${group.id}`);
          try {
            await Promise.all([
              getMembers(group.id),
              getTimelogs(group.id),
              getLabels(group.id),
              getMergeRequests(group.id),
            ]);
            console.log(`[Cache] Successfully warmed data for group: ${group.id}`);
          } catch (groupError) {
            console.error(`[Cache] Error warming data for group ${group.id}:`, groupError);
          }
        }),
      );
    }
    console.log("[Cache] Cache warming completed.");
  } catch (error) {
    console.error("[Cache] Failed to load groups during cache warming:", error);
  } finally {
    warming = false;
  }
}
