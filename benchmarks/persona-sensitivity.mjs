import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

const sourcePath = resolve("docs/webmcp/evals/productivity-benchmark-v2-2026-09-02.json");
const outputPath = resolve("test-results/persona-paced-sensitivity.json");
const benchmark = JSON.parse(await readFile(sourcePath, "utf8"));

const profiles = [
  {
    id: "laboratory-expert",
    label: "Laboratory expert · confident PC user",
    readingWpm: 260,
    typingWpm: 52,
    speakingWpm: 155,
    pointMs: 650,
    fieldTransitionMs: 400,
    reviewWpm: 235,
    orientationMs: { locate: 1000, inventory: 1500, office: 1500 },
  },
  {
    id: "first-time-labspace-user",
    label: "Researcher · first-time LabSpace user",
    readingWpm: 215,
    typingWpm: 38,
    speakingWpm: 135,
    pointMs: 900,
    fieldTransitionMs: 650,
    reviewWpm: 190,
    orientationMs: { locate: 3000, inventory: 4000, office: 3500 },
  },
  {
    id: "general-non-researcher",
    label: "General professional · no laboratory background",
    readingWpm: 190,
    typingWpm: 32,
    speakingWpm: 125,
    pointMs: 1050,
    fieldTransitionMs: 850,
    reviewWpm: 165,
    orientationMs: { locate: 6000, inventory: 8000, office: 7000 },
  },
  {
    id: "programmer",
    label: "Programmer · strong PC skills, limited laboratory context",
    readingWpm: 250,
    typingWpm: 65,
    speakingWpm: 160,
    pointMs: 600,
    fieldTransitionMs: 400,
    reviewWpm: 235,
    orientationMs: { locate: 3500, inventory: 5000, office: 4500 },
  },
  {
    id: "low-digital-confidence",
    label: "General user · low digital confidence",
    readingWpm: 150,
    typingWpm: 18,
    speakingWpm: 105,
    pointMs: 1700,
    fieldTransitionMs: 1500,
    reviewWpm: 125,
    orientationMs: { locate: 10000, inventory: 12000, office: 14000 },
  },
];

const prompts = {
  locate:
    "Find Reference standards, Nitrile gloves M, and Rotary evaporator flask set. Show each exact storage location in a collection guide.",
  inventory:
    "Add five benchmark inventory records with their stated quantities to Drawer 01 of the Chromatography consumables cabinet in room CHR-A, and let me review before saving.",
  office:
    "Create Benchmark Student Office B812 as an 8 by 6 metre room with four walls, two office desks, two office chairs, and one tall cabinet. Let me review both room creation and the furnished plan.",
};

const itemNames = [
  "Benchmark citrate buffer",
  "Benchmark wash solvent",
  "Benchmark sample tubes",
  "Benchmark calibration mix",
  "Benchmark filter membranes",
];

const taskModel = {
  "locate-three-materials": {
    key: "locate",
    briefWords: 18,
    resultWords: 42,
    manual: {
      points: 3,
      entries: ["Reference standards", "Nitrile gloves, M", "Rotary evaporator flask set"],
      reviewWords: 54,
    },
    webmcp: { approvals: [], reviewWords: 60 },
  },
  "add-five-inventory-items": {
    key: "inventory",
    briefWords: 24,
    resultWords: 38,
    manual: {
      points: 15,
      entries: itemNames.flatMap((name, index) => [name, String(index + 1), "boxes"]),
      reviewWords: 42,
    },
    webmcp: { approvals: [72], reviewWords: 42 },
  },
  "furnish-office": {
    key: "office",
    briefWords: 30,
    resultWords: 42,
    manual: {
      points: 13,
      entries: ["Benchmark Student Office", "B812", "Office desk", "Office chair", "Tall cabinet"],
      reviewWords: 46,
    },
    webmcp: { approvals: [28, 76], reviewWords: 46 },
  },
};

function words(value) {
  return value.trim().split(/\s+/).length;
}

function readingMs(wordCount, wpm) {
  return (wordCount / wpm) * 60_000;
}

function entryMs(value, profile) {
  const charactersPerMinute = profile.typingWpm * 5;
  return profile.fieldTransitionMs + (value.length / charactersPerMinute) * 60_000;
}

function recoveryOverhead(taskId, method, profile) {
  if (profile.id === "laboratory-expert") return { milliseconds: 0, description: "None" };
  const task = taskModel[taskId];
  if (method === "manual") {
    if (task.key === "locate") {
      const query = profile.id === "programmer" ? "evaporator supplies" : "rotary flask";
      return {
        milliseconds: entryMs(query, profile) + profile.pointMs + readingMs(12, profile.readingWpm),
        description: "One unsuccessful terminology search, then correction.",
      };
    }
    if (task.key === "inventory") {
      return {
        milliseconds: profile.pointMs * 3 + readingMs(20, profile.readingWpm),
        description: "One wrong cabinet opened, then return and select the correct cabinet.",
      };
    }
    return {
      milliseconds: profile.pointMs * 3 + readingMs(18, profile.readingWpm),
      description: "One room-shape check, Undo, and corrected rectangle drag.",
    };
  }
  if (["general-non-researcher", "low-digital-confidence"].includes(profile.id)) {
    const refinement =
      task.key === "locate"
        ? "Use only recorded inventory and show the exact cabinet or drawer."
        : task.key === "inventory"
          ? "Use CHR-A and the exact recorded Drawer 01, without changing existing stock."
          : "Keep the room exactly 48 square metres and do not modify another room.";
    return {
      milliseconds:
        readingMs(18, profile.readingWpm) +
        entryMs(refinement, profile) +
        readingMs(24, profile.reviewWpm),
      description: "One clarification/refinement after inspecting the agent response.",
    };
  }
  return { milliseconds: 0, description: "None" };
}

function promptEntryMs(prompt, profile, promptMode) {
  if (promptMode === "prepared-paste") {
    return readingMs(words(prompt), profile.readingWpm) + profile.fieldTransitionMs + 500;
  }
  if (promptMode === "voice-reviewed") {
    return (
      900 +
      readingMs(words(prompt), profile.speakingWpm) +
      readingMs(words(prompt), profile.reviewWpm)
    );
  }
  return entryMs(prompt, profile);
}

function humanOverhead(taskId, method, profile, promptMode = "typed-from-scratch") {
  const task = taskModel[taskId];
  let milliseconds =
    profile.orientationMs[task.key] +
    readingMs(task.briefWords, profile.readingWpm) +
    readingMs(task.resultWords, profile.reviewWpm);
  if (method === "manual") {
    milliseconds += task.manual.points * profile.pointMs;
    milliseconds += task.manual.entries.reduce(
      (total, value) => total + entryMs(value, profile),
      0,
    );
    milliseconds += readingMs(task.manual.reviewWords, profile.reviewWpm);
    return milliseconds;
  }
  milliseconds += promptEntryMs(prompts[task.key], profile, promptMode);
  for (const approvalWords of task.webmcp.approvals) {
    milliseconds += readingMs(approvalWords, profile.reviewWpm) + profile.pointMs;
  }
  milliseconds += readingMs(task.webmcp.reviewWords, profile.reviewWpm);
  return milliseconds;
}

const results = [];
for (const profile of profiles) {
  for (const task of benchmark.tasks) {
    for (const method of ["manual", "webmcp"]) {
      const baseSystemMilliseconds = task[method].medianMilliseconds;
      const modeledHumanMilliseconds = humanOverhead(
        task.id,
        method,
        profile,
        "typed-from-scratch",
      );
      const preparedPromptHumanMilliseconds = humanOverhead(
        task.id,
        method,
        profile,
        "prepared-paste",
      );
      const voicePromptHumanMilliseconds = humanOverhead(
        task.id,
        method,
        profile,
        "voice-reviewed",
      );
      const recovery = recoveryOverhead(task.id, method, profile);
      results.push({
        profileId: profile.id,
        taskId: task.id,
        method,
        baseSystemMilliseconds,
        modeledHumanMilliseconds: Math.round(modeledHumanMilliseconds),
        cleanScenarioMilliseconds: Math.round(baseSystemMilliseconds + modeledHumanMilliseconds),
        preparedPromptScenarioMilliseconds: Math.round(
          baseSystemMilliseconds + preparedPromptHumanMilliseconds,
        ),
        voicePromptScenarioMilliseconds: Math.round(
          baseSystemMilliseconds + voicePromptHumanMilliseconds,
        ),
        scriptedRecoveryMilliseconds: Math.round(
          baseSystemMilliseconds + modeledHumanMilliseconds + recovery.milliseconds,
        ),
        scriptedRecovery: recovery.description,
      });
    }
  }
}

const summaries = profiles.map((profile) => {
  const rows = results.filter((entry) => entry.profileId === profile.id);
  const total = (method, field) =>
    rows.filter((entry) => entry.method === method).reduce((sum, entry) => sum + entry[field], 0);
  const manualClean = total("manual", "cleanScenarioMilliseconds");
  const webmcpClean = total("webmcp", "cleanScenarioMilliseconds");
  const manualRecovery = total("manual", "scriptedRecoveryMilliseconds");
  const webmcpRecovery = total("webmcp", "scriptedRecoveryMilliseconds");
  const manualPrepared = total("manual", "preparedPromptScenarioMilliseconds");
  const webmcpPrepared = total("webmcp", "preparedPromptScenarioMilliseconds");
  const manualVoice = total("manual", "voicePromptScenarioMilliseconds");
  const webmcpVoice = total("webmcp", "voicePromptScenarioMilliseconds");
  return {
    profileId: profile.id,
    label: profile.label,
    cleanScenario: {
      promptMode: "typed-from-scratch",
      manualMilliseconds: manualClean,
      webmcpMilliseconds: webmcpClean,
      modeledChangePercent: Number((((webmcpClean - manualClean) / manualClean) * 100).toFixed(1)),
    },
    preparedPromptScenario: {
      promptMode: "prepared-paste",
      manualMilliseconds: manualPrepared,
      webmcpMilliseconds: webmcpPrepared,
      modeledChangePercent: Number(
        (((webmcpPrepared - manualPrepared) / manualPrepared) * 100).toFixed(1),
      ),
    },
    voicePromptScenario: {
      promptMode: "voice-reviewed",
      manualMilliseconds: manualVoice,
      webmcpMilliseconds: webmcpVoice,
      modeledChangePercent: Number((((webmcpVoice - manualVoice) / manualVoice) * 100).toFixed(1)),
    },
    scriptedRecoveryScenario: {
      manualMilliseconds: manualRecovery,
      webmcpMilliseconds: webmcpRecovery,
      modeledChangePercent: Number(
        (((webmcpRecovery - manualRecovery) / manualRecovery) * 100).toFixed(1),
      ),
    },
  };
});

const output = {
  model: "LabSpace persona-paced sensitivity model",
  source: "productivity-benchmark-v2-2026-09-02.json task medians",
  warning:
    "Synthetic sensitivity analysis only. Profiles and recoveries are explicit assumptions, not observed people, disability claims, or usability-study evidence.",
  assumptions: {
    charactersPerWord: 5,
    totalTime: "Measured system median plus modeled human overhead",
    overlapLimitation:
      "The additive model does not estimate overlap between human reading and background application work.",
  },
  profiles,
  summaries,
  results,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(summaries, null, 2)}\n`);
