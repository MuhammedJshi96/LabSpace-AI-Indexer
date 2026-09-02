# LabSpace Atlas — 2:50 user–AI collaboration video

Target duration: **2 minutes 50 seconds**. The product demonstration is structured as evidence of how the user's laboratory expertise, GPT-5.6 in ChatGPT, and Codex worked together throughout the project.

## Central story

- **The user supplied the domain truth:** as a biologist rather than a programmer, the user contributed laboratory experience, Room 809 reference photographs, equipment requirements, corrections, priorities, and final product/design decisions.
- **GPT-5.6 in ChatGPT helped shape the product:** translating observations into workflows, information architecture, interaction contracts, asset specifications, and competition positioning.
- **Codex implemented and stabilized the product:** building the editor and index, authoring asset systems, connecting 2D/3D state, diagnosing reported failures, writing fixes, and adding automated verification.
- **LabSpace itself remains grounded:** the shipped Spatial Index reads stored project records and deterministic geometry. Do not describe it as a live GPT response or imply that it needs API billing.

## Recording preparation

1. Record a 1920 × 1080 browser window at 100% zoom. Hide bookmarks, notifications, and unrelated tabs.
2. Start on **Empty lab plan** in **2D** view with Select active, both side panels open, and no objects selected.
3. Prepare a short wall outline that can be drawn confidently. Add only one door, one window, one bench, and one equipment item during the live build.
4. Rehearse the item move once. Keep the 3D camera still long enough for judges to see that it does not reset.
5. Confirm the header **Demo room** action opens the user's saved **DEMO-01** without changing it.
6. In Spatial Index, use **This room** and search for `rotary evaporator`. Close any previously opened access preview before recording.
7. Use hard cuts between takes. The viewer should experience a continuous story even if the recording is assembled from separate clips.

## Take-by-take flow

### Take 1 — 0:00–0:15 — Begin with the problem

**Screen:** Show the genuinely empty planning canvas. Pause for one second, then place the pointer over Draw walls.

**Purpose:** Establish that LabSpace is a professional builder rather than a pre-rendered room showcase.

### Take 2 — 0:15–0:38 — Introduce the collaboration

**Screen:** Begin drawing a simple continuous wall outline. Keep movement deliberate and avoid opening unrelated controls.

**Purpose:** Establish the central story clearly: a biologist supplied the domain knowledge, GPT-5.6 helped structure the product, and Codex made implementing it accessible without requiring a programming background.

### Take 3 — 0:38–1:08 — Build from an empty room

**Screen sequence:**

1. Finish the wall outline so the floor appears from the enclosed geometry.
2. Add one hosted door and one hosted window.
3. Select a floor material from the Inspector.
4. Switch to Split view.

**Purpose:** Show the blank-first workflow, continuous walls, generated floor, hosted openings, materials, and synchronized views.

### Take 4 — 1:08–1:35 — Place a professional asset

**Screen sequence:**

1. Search the Asset Library for a bench or rotary evaporator.
2. Place it in the room.
3. Move it slightly in 2D and pause on the unchanged 3D camera.
4. Briefly show its material-aware footprint or Inspector information.

**Purpose:** Connect the reference-driven asset work to actual planning behavior.

### Take 5 — 1:35–2:00 — Show iterative engineering quality

**Screen:** Keep Split view visible. Select the object and show its placement status, then undo the move. If available, briefly show Warnings without dwelling on technical text.

**Optional edit:** Insert a three-second montage containing one reference photograph, one earlier bug screenshot, and the corrected interface. Label it **Reference → feedback → tested implementation**.

**Purpose:** Make the user–AI feedback loop tangible rather than merely claiming that AI helped.

### Take 6 — 2:00–2:36 — Move to the completed DEMO-01 workflow

**Screen sequence:**

1. Click **Demo room** to open the saved DEMO-01.
2. Move to **Spatial Index**.
3. Select **This room** and search `rotary evaporator`.
4. Open **BÜCHI rotary evaporator R-300**.
5. Open **Rotary evaporator flask set**.
6. Pause on the evidence Inspector, Drawer 02 path, quantity, owner, and canonical code.
7. Click **Show access preview**.

**Purpose:** Demonstrate the completed value chain: build, index, search, navigate, and prove an exact physical location.

### Take 7 — 2:36–2:50 — Close on the partnership and outcome

**Screen:** Hold the access preview with the room still readable. Add a minimal closing title only if editing is available:

**LabSpace Atlas — Design · Index · Find**

Keep the final frame still for the last two seconds.

## Full voice-over script

### 0:00–0:15

“Laboratories are designed in one place and indexed in another. LabSpace Atlas connects the physical layout, every asset, and every storage location in one spatial digital twin.”

### 0:15–0:38

“I am a biologist, not a programmer. I supplied the laboratory experience, photographs, equipment references, and product decisions. GPT-5.6 in ChatGPT helped translate those requirements into workflows and system architecture; Codex made implementing them accessible and turned them into working software.”

### 0:38–1:08

“Every new project begins empty. I draw a continuous wall outline, add a hosted door and window, choose the floor finish, and place real laboratory equipment. The 2D plan and 3D preview stay synchronized, because Codex implemented one canonical, millimetre-based room model instead of separate visual mock-ups.”

### 1:08–1:35

“The asset library followed the same partnership. I corrected proportions, cabinet anatomy, materials, and real laboratory use. GPT-5.6 interpreted the references, while Codex authored reusable geometry, material-aware footprints, previews, and indexed storage compartments.”

### 1:35–2:00

“Our collaboration continued through testing. I supplied screenshots and explained failures from a laboratory user's perspective. Codex traced camera resets, corner snapping, wall topology, saving, and renderer bugs, then implemented validation and regression tests. It made developing a professional tool approachable for a non-programmer, while I remained responsible for the product decisions.”

### 2:00–2:36

“Now I switch to DEMO-01, the completed workflow. In Spatial Index, I search this room for rotary evaporator. LabSpace finds the BÜCHI equipment and its flask set, focuses the real objects, and reveals the exact path: Preparation, North reagent cabinet, Drawer 02, six flasks, owner, and canonical code. This evidence comes from stored project data—not an invented AI answer—and works without API billing.”

### 2:36–2:50

“Together, human laboratory knowledge, GPT-5.6 reasoning, and Codex implementation transformed an idea into LabSpace Atlas: design the lab, index every asset, and find anything instantly.”

## Delivery suggestions

- Speak at a calm **96–102 words per minute**. The script intentionally leaves room for interface actions and short pauses.
- Emphasize **“I am a biologist, not a programmer”**, **“GPT-5.6 helped”**, and **“Codex made implementing them accessible”** so both the collaboration and its accessibility are unmistakable.
- Do not show lengthy prompting sessions in the main video. A short reference/feedback/correction montage communicates collaboration more effectively while preserving product time.
- Use a small lower-third during the collaboration section: **Domain decisions: Muhammed · Product reasoning: GPT-5.6 · Implementation: Codex**.
- Keep manufacturer names incidental to the workflow. The main story is the LabSpace system and the development partnership.
- Do not claim that the shipped search screen is a live GPT chatbot. It is a grounded, deterministic index; future model-driven intent remains an optional extension.
- If a take runs long, shorten pointer pauses or remove the optional montage. Do not accelerate the interface footage or narration.
- Pronounce **BÜCHI** as “BOO-key” and **DEMO-01** as “demo zero one.”
