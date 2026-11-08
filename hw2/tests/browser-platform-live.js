/* Owner release QA: one synthetic test_ record from the deployed origin.
   After running, the owner must remove ONLY test_attention_browser_v11.
   Never uses a participant ID or any download key. */
async function browserPlatformLive(page) {
  if (new URL(page.url()).hostname !== "bnu-engpsy-fall26.github.io")
    throw Error("Run from the deployed coursework page");
  return page.evaluate(async () => {
    const { project, endpoint, preregistrationCommit } = LAB_CONFIG;
    const experiment = "test_attention_browser_v11";
    const route = `${endpoint}/api/hw2/data?project=${project}&experiment=${experiment}`;
    const before = await (
      await fetch(route, { signal: AbortSignal.timeout(15000) })
    ).json();
    if (!before.ok || before.records.length)
      throw Error("Test bucket not empty; refusing another record");
    const trials = [
      {
        phase: "qa",
        mode: "qa",
        protocol: LAB_CONFIG.protocol,
        session_id: "QA_BROWSER_CORS",
        trial_index: 1,
        rt: 321,
        synthetic: true,
        origin: location.origin,
      },
    ];
    const res = await fetch(endpoint + "/api/hw2/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project,
        experiment,
        participant: "QA_BROWSER_ONLY",
        condition: "synthetic_qa",
        trials,
        meta: {
          mode: "qa",
          synthetic: true,
          preregistration: preregistrationCommit,
        },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (
      !res.ok ||
      !data.ok ||
      data.warnings?.length ||
      data.warning_details?.length
    )
      throw Error("Real cross-origin submit did not pass");
    const returned = await (
      await fetch(route, { signal: AbortSignal.timeout(15000) })
    ).json();
    const actual = returned.records?.[0]?.trials;
    if (
      !returned.ok ||
      returned.records.length !== 1 ||
      actual?.length !== 1 ||
      Object.keys(actual[0]).length !== Object.keys(trials[0]).length ||
      Object.entries(trials[0]).some(([key, value]) => actual[0][key] !== value)
    )
      throw Error("Browser QA readback differs");
    return {
      project,
      experiment,
      record_id: data.record_id,
      syntheticTrials: 1,
      crossOriginPost: true,
      anonymousReadback: true,
      origin: location.origin,
      warnings: 0,
      ownerCleanupRequired: true,
    };
  });
}
