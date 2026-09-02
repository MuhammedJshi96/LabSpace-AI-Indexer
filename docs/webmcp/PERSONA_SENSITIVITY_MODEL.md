# Persona-paced sensitivity model

This model answers a narrow question: “What happens if the same verified LabSpace tasks are paced using different reading, typing, pointing, orientation, and review assumptions?” It is a synthetic sensitivity analysis, not a usability study and not evidence about any real demographic group.

The model starts with the measured application medians in the [productivity benchmark v2](PRODUCTIVITY_BENCHMARK_V2.md), then adds explicit human-overhead assumptions. It never changes the completed outcome. Five behavior profiles are included:

- laboratory expert with confident PC use;
- researcher using LabSpace for the first time;
- general professional without laboratory background;
- programmer with strong PC skills but limited laboratory context;
- general user with low digital confidence.

The labels describe the simulated interaction assumptions only. They do not claim that expertise, age, disability, occupation, or computer confidence determines a real person's speed.

## Main sensitivity result

The largest variable is not the persona—it is **how the WebMCP request is entered**.

| Simulated profile                        | Manual suite | Typed WebMCP |       Change | Prepared/pasted WebMCP |       Change | Voice + transcript review |       Change |
| ---------------------------------------- | -----------: | -----------: | -----------: | ---------------------: | -----------: | ------------------------: | -----------: |
| Laboratory expert · confident PC         |         3:31 |         4:21 | 23.7% slower |                   2:48 | 20.6% faster |                      3:21 |  4.9% faster |
| Researcher · first-time LabSpace         |         4:34 |         5:42 | 24.6% slower |                   3:30 | 23.4% faster |                      4:08 |  9.4% faster |
| General professional · no lab background |         5:25 |         6:46 | 24.9% slower |                   4:09 | 23.6% faster |                      4:50 | 10.9% faster |
| Programmer · limited lab context         |         3:27 |         4:08 | 20.0% slower |                   2:58 | 13.9% faster |                      3:30 |  1.4% slower |
| General user · low digital confidence    |         8:13 |        10:27 | 27.3% slower |                   5:32 | 32.5% faster |                      6:22 | 22.5% faster |

These values cover one modeled pass through the same three-task suite. “Prepared prompt” includes reading the prompt, moving focus, and pasting it; it is not zero-cost input. “Voice” includes microphone activation, profile-specific speaking time, and reading the full transcript before submission. It does not assume perfect recognition or unsafe automatic submission.

## Interpretation

Typing three detailed prompts from scratch makes WebMCP slower in every simulated profile even though the tool path needs fewer direct operations. Reading and pasting clear prepared workflows reverses the result for every profile. Reviewed voice prompting is faster for four profiles and approximately tied for the fast-typing programmer. That means the product should not rely on users knowing how to formulate a long typed agent request unaided.

The useful design implication is concrete:

1. Keep judge workflows short, copyable, and outcome-specific.
2. Show the exact approval boundary before the user starts.
3. Prefer editable prompt templates or reviewed voice input for long room programs.
4. Keep ordinary UI efficient because experts may be faster manually for short, familiar operations.
5. Treat WebMCP as strongest for multi-step, cross-workspace outcomes—not as a replacement for every button.

## Recovery scenarios

The generator also includes one explicitly scripted recovery per unfamiliar manual task: an unsuccessful terminology search, a wrong cabinet selection, or a room-shape correction. For the two lowest-domain-confidence WebMCP profiles it models one prompt clarification. These are stress scenarios selected for sensitivity testing, not error probabilities. They must not be averaged into a human-performance claim.

## Reproduction and assumptions

Run:

```text
npm run benchmark:webmcp:personas
```

The configurable profiles and action traces are in [`benchmarks/persona-sensitivity.mjs`](../../benchmarks/persona-sensitivity.mjs). The assumptions and summary output are stored in [`evals/persona-paced-sensitivity-2026-09-02.json`](evals/persona-paced-sensitivity-2026-09-02.json).

The model assumes five characters per typed word and adds modeled human overhead to measured application medians. It does not estimate overlap between reading and background application work. Real participant testing remains necessary before describing any result as human speed.
