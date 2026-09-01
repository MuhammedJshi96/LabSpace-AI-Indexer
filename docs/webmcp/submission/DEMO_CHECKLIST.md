# WebMCP Challenge demo checklist

## Before recording or judging

- [ ] Open the final public HTTPS URL or production build.
- [ ] Confirm DEMO-01 is the active user-authored showcase; do not reset or overwrite it.
- [ ] Confirm no pending staged change is present.
- [ ] Confirm Agent Activity is clear/collapsed at the start.
- [ ] Confirm the 2D/3D room and evidence images are fully loaded.
- [ ] Confirm `document.modelContext.getTools()` returns twenty-three unique LabSpace tools.
- [ ] Confirm `/asset-preview` and `/procedural-asset-capture` expose no LabSpace tools.
- [ ] Close private tabs, local paths, notifications, and unrelated consoles.

## Canonical story

- [ ] Ask the agent to create Office for Students, room 812, with a six-wall shell of roughly 32 m², four desks/chairs, one cabinet, one door, and one observation window.
- [ ] Confirm Floor 8 is inferred from room code 812 and the room begins genuinely blank.
- [ ] Confirm planning alone does not change the room.
- [ ] Confirm Reviewed stages room creation and the first blueprint; then authorize Fast Draft and confirm only the validated additive room plus complete pristine blueprint auto-apply, with the blueprint available to Undo.
- [ ] Show one-step Undo/Redo of the complete initial blueprint.
- [ ] Request one additional asset and confirm the later plan opens **Preview · not saved** with human Approve/Cancel.
- [ ] Search BÜCHI rotary evaporator and its flask set.
- [ ] Inspect canonical evidence and storage path.
- [ ] Focus exact record; verify camera/evidence transition.
- [ ] Validate trolley at X 4317.544 mm, Y 7.507 mm, −180°; show blocked evidence and no mutation.
- [ ] Validate trolley at X 3887.107 mm, Y 8006.071 mm, −180°; show valid result.
- [ ] Stage the valid move; show **Preview · not saved** and current/proposed coordinates.
- [ ] Demonstrate Cancel once if time allows, then restage.
- [ ] Human clicks **Approve move**; agent does not approve.
- [ ] Wait for saved status, then demonstrate Undo/Redo.
- [ ] Open Agent Activity and show bounded factual evidence.

## Release evidence

- [ ] `npm ci` passes from a clean tree.
- [ ] `npm run release:check` passes.
- [ ] `npm run test:e2e:webmcp` passes 7/7.
- [ ] Production `/api/health`, `/`, and `/digital-twin` smoke checks pass.
- [ ] `pre-webmcp-2026-08-27` points to the baseline evidence commit.
- [ ] `webmcp-submission-v1.1` points to the verified deployed branch commit.
- [ ] Apache-2.0 `LICENSE` is visible; separate asset terms remain linked.

## Submission

- [ ] Public repository points to `webmcp-challenge-2026` or final tag.
- [ ] Live URL inserted into README, judge guide, and Devpost.
- [ ] Public YouTube video is under 3:00 and has audio.
- [ ] Video clearly shows the real WebMCP workflow and explains how WebMCP was implemented.
- [ ] Video is public on YouTube, in English, and contains no unauthorized music or third-party trademarks.
- [ ] Repository license is detected in GitHub's About panel and the pre-existing/new-work boundary is linked.
- [ ] Devpost copy is pasted and links are tested in a signed-out window.
- [ ] Final submit action is performed by the user.
