import {
  ArrowCounterClockwise,
  Blueprint,
  Check,
  FileArrowUp,
  MagicWand,
  Polygon,
  Ruler,
  X,
} from "@phosphor-icons/react";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { planRoomLayout } from "../agent/labspace-layout-actions";
import { stageRoomLayout } from "../agent/labspace-staging-actions";
import {
  blueprintTraceToRoomVertices,
  suggestBlueprintRectangle,
  type BlueprintPoint,
} from "../domain/blueprint";
import { selectActiveRoom, useEditorStore } from "../store/editor-store";

type BlueprintSource = {
  url: string;
  width: number;
  height: number;
  name: string;
  kind: "image" | "pdf";
};

type DragTarget = { kind: "scale" | "outline"; index: number } | null;

function imageSize(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("The selected image could not be decoded."));
    image.src = url;
  });
}

async function renderBlueprintFile(file: File): Promise<BlueprintSource> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const page = await document.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2.2, 1800 / Math.max(1, base.width)) });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("The browser could not prepare the PDF page.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return {
      url: canvas.toDataURL("image/png", 0.96),
      width: canvas.width,
      height: canvas.height,
      name: `${file.name} · page 1`,
      kind: "pdf",
    };
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a PDF, PNG, JPG, WEBP or SVG floor plan.");
  }
  const url = URL.createObjectURL(file);
  try {
    const dimensions = await imageSize(url);
    return { url, ...dimensions, name: file.name, kind: "image" };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function formatMetres(value: number) {
  return `${(value / 1000).toFixed(2)} m`;
}

function canvasPoint(
  event: ReactPointerEvent<SVGSVGElement>,
  source: BlueprintSource,
): BlueprintPoint {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.min(source.width, Math.max(0, ((event.clientX - bounds.left) / bounds.width) * source.width)),
    y: Math.min(source.height, Math.max(0, ((event.clientY - bounds.top) / bounds.height) * source.height)),
  };
}

export function BlueprintImportDialog() {
  const dialog = useEditorStore((state) => state.dialog);
  const setDialog = useEditorStore((state) => state.setDialog);
  const room = useEditorStore(selectActiveRoom);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const saveNow = useEditorStore((state) => state.saveNow);
  const pendingAgentChange = useEditorStore((state) => state.pendingAgentChange);
  const setPresentation = useEditorStore((state) => state.setPresentation);
  const pushToast = useEditorStore((state) => state.pushToast);
  const imageRef = useRef<HTMLImageElement>(null);
  const [source, setSource] = useState<BlueprintSource | null>(null);
  const [mode, setMode] = useState<"scale" | "outline">("scale");
  const [scalePoints, setScalePoints] = useState<BlueprintPoint[]>([]);
  const [outlinePoints, setOutlinePoints] = useState<BlueprintPoint[]>([]);
  const [knownLengthMetres, setKnownLengthMetres] = useState(5);
  const [wallHeightMm, setWallHeightMm] = useState(3000);
  const [wallThicknessMm, setWallThicknessMm] = useState(150);
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const [loading, setLoading] = useState(false);
  const [staging, setStaging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [suggestionKind, setSuggestionKind] = useState<"detected" | "page-bounds" | null>(null);

  const hasWalls = room.scene.objects.some((object) => object.visible && object.objectType === "wall");
  const scaleDistance =
    scalePoints.length === 2
      ? Math.hypot(scalePoints[1].x - scalePoints[0].x, scalePoints[1].y - scalePoints[0].y)
      : 0;
  const millimetresPerPixel =
    scaleDistance > 0 && knownLengthMetres > 0 ? (knownLengthMetres * 1000) / scaleDistance : 0;
  const trace = useMemo(() => {
    try {
      return {
        metrics: blueprintTraceToRoomVertices(outlinePoints, millimetresPerPixel),
        error: null,
      };
    } catch (error) {
      return { metrics: null, error: error instanceof Error ? error.message : "Trace unavailable." };
    }
  }, [millimetresPerPixel, outlinePoints]);

  if (dialog !== "blueprint") return null;

  const close = () => {
    if (!staging) setDialog(null);
  };

  const suggestOutline = (image = imageRef.current) => {
    if (!image || !source) return;
    const maximum = 1100;
    const ratio = Math.min(1, maximum / Math.max(source.width, source.height));
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.max(20, Math.round(source.width * ratio));
    canvas.height = Math.max(20, Math.round(source.height * ratio));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const suggestion = suggestBlueprintRectangle(
      context.getImageData(0, 0, canvas.width, canvas.height).data,
      canvas.width,
      canvas.height,
    );
    setOutlinePoints(
      suggestion.points.map((point) => ({ x: point.x / ratio, y: point.y / ratio })),
    );
    setSuggestionKind(suggestion.confidence);
    setMessage(
      suggestion.confidence === "detected"
        ? "Strong wall lines detected. Drag the four corners or retrace any irregular perimeter."
        : "No strong rectangular wall pair was found. Page bounds are shown only as a starting guide.",
    );
  };

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setMessage(null);
    try {
      if (source?.url.startsWith("blob:")) URL.revokeObjectURL(source.url);
      const next = await renderBlueprintFile(file);
      setSource(next);
      setScalePoints([]);
      setOutlinePoints([]);
      setSuggestionKind(null);
      setMode("scale");
      setMessage("Set scale by selecting two points with a known real-world distance.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The blueprint could not be opened.");
    } finally {
      setLoading(false);
    }
  };

  const handleCanvasClick = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!source || dragTarget) return;
    const point = canvasPoint(event, source);
    if (mode === "scale") {
      setScalePoints((current) => (current.length >= 2 ? [point] : [...current, point]));
    } else if (outlinePoints.length < 16) {
      setOutlinePoints((current) => [...current, point]);
      setSuggestionKind(null);
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!source || !dragTarget) return;
    const point = canvasPoint(event, source);
    if (dragTarget.kind === "scale") {
      setScalePoints((current) => current.map((entry, index) => (index === dragTarget.index ? point : entry)));
    } else {
      setOutlinePoints((current) => current.map((entry, index) => (index === dragTarget.index ? point : entry)));
      setSuggestionKind(null);
    }
  };

  const stageProposal = async () => {
    if (!trace.metrics || hasWalls || pendingAgentChange) return;
    setStaging(true);
    setMessage(null);
    try {
      if (saveStatus !== "saved") await saveNow();
      if (useEditorStore.getState().saveStatus !== "saved") {
        throw new Error("Finish saving the current room before staging the imported outline.");
      }
      const plan = planRoomLayout({
        brief: `Blueprint import from ${source?.name ?? "local plan"}`,
        assets: [],
        roomShell: {
          vertices: trace.metrics.vertices,
          wallHeightMm,
          wallThicknessMm,
        },
      });
      stageRoomLayout({ planId: plan.planId });
      setPresentation("split");
      setDialog(null);
      pushToast("Blueprint staged as an editable room shell. Review it before approval.", "success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The room proposal could not be staged.");
    } finally {
      setStaging(false);
    }
  };

  const aspect = source ? source.width / source.height : 1.4;

  return (
    <div className="modal-backdrop blueprint-backdrop" role="presentation">
      <section className="blueprint-dialog" role="dialog" aria-modal="true" aria-labelledby="blueprint-title">
        <header>
          <span className="blueprint-title-mark"><Blueprint size={21} weight="duotone" /></span>
          <span>
            <small>Survey-to-model workflow</small>
            <h2 id="blueprint-title">Blueprint to Lab</h2>
          </span>
          <em>Local processing · reversible proposal</em>
          <button onClick={close} aria-label="Close blueprint import"><X size={18} /></button>
        </header>

        <aside className="blueprint-steps" aria-label="Blueprint import steps">
          {[
            { label: "Source", complete: Boolean(source), icon: <FileArrowUp size={18} weight="duotone" /> },
            { label: "Scale", complete: scalePoints.length === 2 && millimetresPerPixel > 0, icon: <Ruler size={18} weight="duotone" /> },
            { label: "Outline", complete: Boolean(trace.metrics), icon: <Polygon size={18} weight="duotone" /> },
            { label: "Review", complete: Boolean(trace.metrics) && !hasWalls, icon: <Check size={18} weight="duotone" /> },
          ].map(({ label, complete, icon }, index) => (
            <button
              key={String(label)}
              className={(mode === (index === 1 ? "scale" : index === 2 ? "outline" : "") ? "active " : "") + (complete ? "complete" : "")}
              onClick={() => index === 1 ? setMode("scale") : index === 2 ? setMode("outline") : undefined}
              disabled={index > 0 && !source}
            >
              <span>{index + 1}</span>
              {icon}
              <b>{label}</b>
            </button>
          ))}
          <div className="blueprint-privacy-note">
            <b>Evidence boundary</b>
            <span>The source file stays in this browser session. Only approved wall geometry enters the project.</span>
          </div>
        </aside>

        <main className="blueprint-workspace">
          {!source ? (
            <label className="blueprint-dropzone">
              <FileArrowUp size={34} weight="duotone" />
              <b>{loading ? "Preparing blueprint…" : "Choose an existing floor plan"}</b>
              <span>PDF, PNG, JPG, WEBP or SVG · first PDF page</span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={loading}
                onChange={(event) => void loadFile(event.target.files?.[0])}
              />
            </label>
          ) : (
            <>
              <div className="blueprint-workspace-toolbar">
                <span><b>{source.name}</b><small>{source.width} × {source.height} px</small></span>
                <div className="blueprint-mode-switch" aria-label="Blueprint tracing mode">
                  <button className={mode === "scale" ? "active" : ""} onClick={() => setMode("scale")}><Ruler size={16} /> Set scale</button>
                  <button className={mode === "outline" ? "active" : ""} onClick={() => setMode("outline")}><Polygon size={16} /> Trace perimeter</button>
                </div>
                <label className="blueprint-replace"><FileArrowUp size={15} /> Replace<input type="file" accept="application/pdf,image/*" onChange={(event) => void loadFile(event.target.files?.[0])} /></label>
              </div>
              <div className="blueprint-sheet-stage">
                <div
                  className="blueprint-sheet"
                  style={aspect >= 1.28 ? { width: "100%", aspectRatio: String(aspect) } : { height: "100%", aspectRatio: String(aspect) }}
                >
                  <img
                    ref={imageRef}
                    src={source.url}
                    alt="Imported laboratory blueprint"
                    onLoad={(event) => {
                      if (!outlinePoints.length) suggestOutline(event.currentTarget);
                    }}
                  />
                  <svg
                    viewBox={`0 0 ${source.width} ${source.height}`}
                    aria-label={mode === "scale" ? "Select two scale points" : "Trace ordered room corners"}
                    onClick={handleCanvasClick}
                    onPointerMove={handlePointerMove}
                    onPointerUp={() => setDragTarget(null)}
                    onPointerCancel={() => setDragTarget(null)}
                  >
                    {outlinePoints.length > 1 && (
                      <polygon
                        className="blueprint-outline-fill"
                        points={outlinePoints.map((point) => `${point.x},${point.y}`).join(" ")}
                      />
                    )}
                    {outlinePoints.map((point, index) => (
                      <g key={`outline-${index}`} className="blueprint-outline-point">
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={Math.max(5, source.width / 180)}
                          onPointerDown={(event) => { event.stopPropagation(); setDragTarget({ kind: "outline", index }); }}
                        />
                        <text x={point.x} y={point.y}>{index + 1}</text>
                      </g>
                    ))}
                    {scalePoints.length > 1 && (
                      <line className="blueprint-scale-line" x1={scalePoints[0].x} y1={scalePoints[0].y} x2={scalePoints[1].x} y2={scalePoints[1].y} />
                    )}
                    {scalePoints.map((point, index) => (
                      <circle
                        key={`scale-${index}`}
                        className="blueprint-scale-point"
                        cx={point.x}
                        cy={point.y}
                        r={Math.max(5, source.width / 175)}
                        onPointerDown={(event) => { event.stopPropagation(); setDragTarget({ kind: "scale", index }); }}
                      />
                    ))}
                  </svg>
                  <span className={`blueprint-mode-cursor ${mode}`}>
                    {mode === "scale" ? `${scalePoints.length}/2 scale points` : `${outlinePoints.length} corners`}
                  </span>
                </div>
              </div>
            </>
          )}
        </main>

        <aside className="blueprint-inspector">
          <div className="blueprint-inspector-heading">
            <span className="eyebrow">Calibration</span>
            <h3>Measured room shell</h3>
            <p>Confirm the source scale, then review every proposed corner.</p>
          </div>
          <label>
            <span>Known distance</span>
            <div className="blueprint-unit-input"><input type="number" min="0.5" max="50" step="0.1" value={knownLengthMetres} onChange={(event) => setKnownLengthMetres(Number(event.target.value))} /><b>m</b></div>
          </label>
          <div className="blueprint-calibration-status">
            <Ruler size={18} />
            <span><b>{millimetresPerPixel ? `${millimetresPerPixel.toFixed(2)} mm / pixel` : "Select two points"}</b><small>The line should follow a known wall or dimension mark.</small></span>
          </div>
          <div className="blueprint-outline-actions">
            <button onClick={() => { setMode("outline"); suggestOutline(); }} disabled={!source}><MagicWand size={16} /> Detect outer walls</button>
            <button onClick={() => { setMode("outline"); setOutlinePoints([]); setSuggestionKind(null); }} disabled={!source}><ArrowCounterClockwise size={16} /> Retrace</button>
          </div>
          {suggestionKind && <small className={`blueprint-detection-${suggestionKind}`}>{suggestionKind === "detected" ? "Long wall pairs detected" : "Page-boundary guide only"}</small>}
          <div className="blueprint-metrics">
            <span><small>Width</small><b>{trace.metrics ? formatMetres(trace.metrics.widthMm) : "—"}</b></span>
            <span><small>Depth</small><b>{trace.metrics ? formatMetres(trace.metrics.depthMm) : "—"}</b></span>
            <span><small>Area</small><b>{trace.metrics ? `${trace.metrics.areaM2.toFixed(2)} m²` : "—"}</b></span>
            <span><small>Walls</small><b>{trace.metrics?.vertices.length ?? "—"}</b></span>
          </div>
          <div className="blueprint-wall-specs">
            <label><span>Wall height</span><div className="blueprint-unit-input"><input type="number" min="2400" max="6000" step="100" value={wallHeightMm} onChange={(event) => setWallHeightMm(Number(event.target.value))} /><b>mm</b></div></label>
            <label><span>Thickness</span><div className="blueprint-unit-input"><input type="number" min="100" max="300" step="10" value={wallThicknessMm} onChange={(event) => setWallThicknessMm(Number(event.target.value))} /><b>mm</b></div></label>
          </div>
          {(message || trace.error) && <p className="blueprint-message" role="status">{message ?? trace.error}</p>}
          {hasWalls && <p className="blueprint-blocker">Blueprint import requires a blank room. Existing walls are protected.</p>}
          {pendingAgentChange && <p className="blueprint-blocker">Resolve the current staged change before importing another room shell.</p>}
          <button
            className="blueprint-stage-button"
            disabled={!trace.metrics || hasWalls || Boolean(pendingAgentChange) || staging}
            onClick={() => void stageProposal()}
          >
            <Blueprint size={18} weight="duotone" />
            {staging ? "Staging measured shell…" : "Stage editable room proposal"}
          </button>
          <small className="blueprint-stage-note">Nothing is saved until you approve the cyan plan in LabSpace.</small>
        </aside>
      </section>
    </div>
  );
}
