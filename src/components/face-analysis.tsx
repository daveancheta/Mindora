"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Camera, CameraOff, Check, EyeOff, MessageCircle, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { FaceLandmarker } from "@mediapipe/tasks-vision";
import type { LocalSettings } from "@/lib/chat/types";
import { describeMovements, optionalSummary, type BlendshapeScore } from "@/lib/face/signals";

type Preferences = { preview: boolean; mesh: boolean; indicators: boolean; shareWithAi: boolean; frequency: number };
type Point = { x: number; y: number };
const DEFAULT_PREFERENCES: Preferences = { preview: true, mesh: false, indicators: false, shareWithAi: false, frequency: 5 };
const PREF_KEY = "mindspace.face-preferences.v1";
const SETTINGS_KEY = "mindspace.local-settings.v1";
function loadPrefs(): Preferences { try { return { ...DEFAULT_PREFERENCES, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}") }; } catch { return DEFAULT_PREFERENCES; } }
function localAiSettings(): LocalSettings { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") ?? { endpoint: "http://127.0.0.1:11434", model: "", style: "friendly" }; } catch { return { endpoint: "http://127.0.0.1:11434", model: "", style: "friendly" }; } }

export function FaceAnalysis() {
  const [prefs, setPrefs] = useState(DEFAULT_PREFERENCES); const prefsRef = useRef(prefs); const [consent, setConsent] = useState(false);
  const [cameraOn, setCameraOn] = useState(false); const cameraOnRef = useRef(false); const [busy, setBusy] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("Camera is off"); const [faceStatus, setFaceStatus] = useState("Face detection is off"); const [error, setError] = useState(""); const [modelReady, setModelReady] = useState<boolean | null>(null);
  const [movements, setMovements] = useState<string[]>([]); const [aiReply, setAiReply] = useState(""); const [shareBusy, setShareBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null); const canvasRef = useRef<HTMLCanvasElement>(null); const workerRef = useRef<Worker | null>(null); const streamRef = useRef<MediaStream | null>(null); const rafRef = useRef<number | null>(null); const mountedRef = useRef(true); const runId = useRef(0); const frameBusy = useRef(false); const lastFrame = useRef(0); const seen = useRef(0); const misses = useRef(0); const smoothValues = useRef<Record<string, number>>({});
  const updatePrefs = useCallback((update: Partial<Preferences>) => { setPrefs((current) => { const next = { ...current, ...update }; prefsRef.current = next; localStorage.setItem(PREF_KEY, JSON.stringify(next)); return next; }); }, []);

  useEffect(() => {
    mountedRef.current = true; const initial = loadPrefs(); prefsRef.current = initial; setPrefs(initial);
    void Promise.all(["/mediapipe/models/face_landmarker.task", "/mediapipe/wasm/vision_wasm_internal.js", "/mediapipe/wasm/vision_wasm_internal.wasm"].map((asset) => fetch(asset, { method: "HEAD", cache: "no-store" }))).then((responses) => { if (mountedRef.current) setModelReady(responses.every((response) => response.ok)); }).catch(() => { if (mountedRef.current) setModelReady(false); });
    return () => { mountedRef.current = false; stopCamera("Camera stopped because you left Face analysis."); };
    // stopCamera reads current refs and doesn't depend on React state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { workerRef.current?.postMessage({ type: "expressions", enabled: prefs.indicators }); }, [prefs.indicators]);

  const clearOverlay = () => { const canvas = canvasRef.current; const context = canvas?.getContext("2d"); if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height); };
  function stopCamera(message = "Camera stopped.") {
    runId.current++; cameraOnRef.current = false;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); rafRef.current = null;
    workerRef.current?.terminate(); workerRef.current = null; frameBusy.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null;
    const video = videoRef.current; if (video) { video.pause(); video.srcObject = null; }
    clearOverlay();
    if (mountedRef.current) { setCameraOn(false); setBusy(false); setCameraStatus(message); setFaceStatus("Face detection is off"); setMovements([]); }
    smoothValues.current = {}; seen.current = 0; misses.current = 0;
  }

  async function enableCamera() {
    if (cameraOnRef.current || busy) return;
    setError(""); setAiReply(""); setMovements([]);
    if (!consent) { setError("Please read the camera information and confirm consent before enabling the camera."); return; }
    if (!modelReady) { setError("The local face model asset is missing. Restore public/mediapipe/models/face_landmarker.task and reload."); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof Worker === "undefined") { setError("This browser does not support local camera processing. Try a current browser on localhost or HTTPS."); return; }
    setBusy(true); setCameraStatus("Requesting camera permission…"); const currentRun = ++runId.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (!mountedRef.current || currentRun !== runId.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream; const video = videoRef.current; if (!video) throw new Error("Camera preview could not be initialized.");
      video.srcObject = stream; await video.play();
      const worker = new Worker(new URL("../lib/face/landmarker.worker.ts", import.meta.url), { type: "module", name: "mindspace-face-landmarker" }); workerRef.current = worker;
      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("The local face model did not start in time.")), 20_000);
        worker.onmessage = (event: MessageEvent) => { if (event.data?.type === "ready") { clearTimeout(timeout); resolve(); } else if (event.data?.type === "error") { clearTimeout(timeout); reject(new Error(event.data.message)); } };
        worker.onerror = () => { clearTimeout(timeout); reject(new Error("The local MediaPipe worker could not start.")); };
        worker.postMessage({ type: "init", expressions: prefsRef.current.indicators });
      });
      if (currentRun !== runId.current || !mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); worker.terminate(); return; }
      cameraOnRef.current = true; setCameraOn(true); setBusy(false); setCameraStatus("Camera on · frames processed on this device"); setFaceStatus("Looking for a face…");
      worker.onmessage = (event: MessageEvent) => onWorkerMessage(event.data);
      startFrameLoop(currentRun);
    } catch (cause) {
      streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; workerRef.current?.terminate(); workerRef.current = null;
      cameraOnRef.current = false; setCameraOn(false); setBusy(false); setCameraStatus("Camera is off");
      const errorName = cause instanceof DOMException ? cause.name : "";
      setError(errorName === "NotAllowedError" || errorName === "SecurityError" ? "Camera permission was denied or blocked. Allow camera access in your browser settings, then try again." : errorName === "NotFoundError" ? "No camera was found. Connect a camera or continue without this optional feature." : errorName === "NotReadableError" ? "The camera is busy or unavailable. Close other apps using it and try again." : cause instanceof Error ? cause.message : "The camera could not be started.");
    }
  }

  function onWorkerMessage(data: { type?: string; message?: string; hasFace?: boolean; landmarks?: Point[]; categories?: BlendshapeScore[] }) {
    if (data.type === "error") { setError(data.message ?? "Local face detection failed."); stopCamera("Camera stopped after a local processing error."); return; }
    if (data.type !== "result") return;
    frameBusy.current = false;
    if (!data.hasFace) { misses.current++; seen.current = 0; clearOverlay(); if (misses.current >= 2) { setFaceStatus("Face not currently visible"); setMovements(prefsRef.current.indicators ? ["Signal uncertain"] : []); } return; }
    seen.current++; misses.current = 0; setFaceStatus(seen.current < 2 ? "Checking face visibility…" : "Face detected · local processing");
    if (prefsRef.current.mesh && data.landmarks) drawMesh(data.landmarks);
    else clearOverlay();
    if (prefsRef.current.indicators) {
      const result = describeMovements(data.categories ?? [], smoothValues.current); smoothValues.current = result.smoothed;
      setMovements(result.signals.length ? result.signals : ["Signal uncertain"]);
    } else setMovements([]);
  }

  function drawMesh(points: Point[]) {
    const video = videoRef.current; const canvas = canvasRef.current; if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
    const context = canvas.getContext("2d"); if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height); context.strokeStyle = "rgba(168, 150, 255, .53)"; context.lineWidth = Math.max(0.7, canvas.width / 800);
    for (const edge of FaceLandmarker.FACE_LANDMARKS_TESSELATION) {
      const start = points[edge.start]; const end = points[edge.end]; if (!start || !end) continue;
      context.beginPath(); context.moveTo(start.x * canvas.width, start.y * canvas.height); context.lineTo(end.x * canvas.width, end.y * canvas.height); context.stroke();
    }
  }

  function startFrameLoop(currentRun: number) {
    const tick = async (now: number) => {
      if (!cameraOnRef.current || currentRun !== runId.current) return;
      const video = videoRef.current; const worker = workerRef.current; const delay = 1000 / prefsRef.current.frequency;
      if (video && worker && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && !frameBusy.current && now - lastFrame.current >= delay) {
        frameBusy.current = true; lastFrame.current = now;
        try { const bitmap = await createImageBitmap(video); if (cameraOnRef.current && currentRun === runId.current) worker.postMessage({ type: "frame", bitmap, timestamp: Math.round(now), mesh: prefsRef.current.mesh, expressions: prefsRef.current.indicators }, [bitmap]); else bitmap.close(); }
        catch { frameBusy.current = false; setError("A camera frame could not be processed. Try restarting the camera."); }
      }
      if (cameraOnRef.current && currentRun === runId.current) rafRef.current = requestAnimationFrame((time) => { void tick(time); });
    };
    rafRef.current = requestAnimationFrame((time) => { void tick(time); });
  }

  async function shareSummary() {
    if (!prefs.shareWithAi || !cameraOnRef.current || shareBusy || !movements.length) return;
    const localSettings = localAiSettings(); setShareBusy(true); setAiReply(""); setError("");
    try {
      const available = await fetch("/api/ollama/models", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: localSettings.endpoint }) });
      const modelList = await available.json() as { connected?: boolean; models?: { name: string }[] };
      const model = modelList.models?.find((item) => item.name === localSettings.model)?.name ?? modelList.models?.[0]?.name;
      if (!available.ok || !model) throw new Error("Connect Ollama and select a local model in AI & privacy settings first.");
      const summary = optionalSummary(movements.filter((item) => item !== "Signal uncertain").map((item) => item.toLowerCase()) as Parameters<typeof optionalSummary>[0]);
      const content = `Optional, uncertain observable facial-movement context: ${summary} These movements do not reveal how I feel. Please ask how I am feeling; do not infer or diagnose an emotion.`;
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", Accept: "text/event-stream" }, body: JSON.stringify({ endpoint: localSettings.endpoint, model, style: localSettings.style, messages: [{ role: "user", content }], memories: [] }) });
      if (!response.ok || !response.body) { const result = await response.json().catch(() => ({})) as { error?: string }; throw new Error(result.error ?? "Your local AI companion is unavailable."); }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = ""; let answer = "";
      while (true) { const { done, value } = await reader.read(); if (done) break; pending += decoder.decode(value, { stream: true }); let split: number; while ((split = pending.indexOf("\n\n")) >= 0) { const frame = pending.slice(0, split); pending = pending.slice(split + 2); const line = frame.split("\n").find((part) => part.startsWith("data: ")); if (!line) continue; const entry = JSON.parse(line.slice(6)) as { token?: string; error?: string }; if (entry.error) throw new Error(entry.error); if (entry.token) { answer += entry.token; setAiReply(answer); } } }
      if (!answer) throw new Error("Your local AI returned no response.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not share the optional summary."); }
    finally { setShareBusy(false); }
  }

  const setToggle = (key: keyof Omit<Preferences, "frequency">, checked: boolean) => updatePrefs({ [key]: checked } as Partial<Preferences>);
  function resetSettings() { if (cameraOnRef.current) stopCamera("Camera stopped because settings were reset."); localStorage.removeItem(PREF_KEY); prefsRef.current = DEFAULT_PREFERENCES; setPrefs(DEFAULT_PREFERENCES); setConsent(false); setAiReply(""); setMovements([]); setError(""); }
  function clearDerived() { setMovements([]); setAiReply(""); smoothValues.current = {}; clearOverlay(); setFaceStatus(cameraOnRef.current ? "Looking for a face…" : "Face detection is off"); }

  return <div className="face-page">
    <section className="face-card face-consent"><div className="face-title"><div className="feature-icon"><Camera size={18}/></div><div><h2>Optional on-device face landmarks</h2><p className="smalltext muted">This is a visual demonstration, not an emotion or health assessment.</p></div><span className={`status ${cameraOn ? "face-on" : ""}`}><i className={`dot${cameraOn ? " teal" : ""}`}/>{cameraOn ? "Camera on" : "Camera off"}</span></div>
      <p className="face-explanation">With your permission, MindSpace can locate face landmarks and describe limited visible movements. It cannot know your feelings, identity, intent, or mental health. Video frames and landmarks stay in this browser, are processed locally, and are never saved. Only an optional, minimal text summary can be shared with local Ollama if you separately enable that and choose to send it.</p>
      <label className="consent-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)}/><span>I understand what this camera feature does and want to turn it on.</span></label>
      <div className="row face-camera-actions"><button className={`button ${cameraOn ? "danger" : "primary"}`} onClick={() => cameraOn ? stopCamera() : void enableCamera()} disabled={busy || (!cameraOn && !modelReady)} aria-pressed={cameraOn}>{cameraOn ? <CameraOff size={15}/> : <Camera size={15}/ >}{busy ? "Starting camera…" : cameraOn ? "Stop camera" : modelReady === false ? "Local model missing" : "Enable camera"}</button>{cameraOn && <button className="button danger-outline" onClick={() => stopCamera()}><CameraOff size={14}/> Stop Camera</button>}<span className="smalltext muted">{modelReady === null ? "Checking local model assets…" : modelReady ? "Local model assets ready" : "Local model asset unavailable"}</span></div>
      {error && <div className="form-error face-error" role="alert"><AlertTriangle size={14}/>{error}</div>}
    </section>
    <section className="face-card"><div className="card-head"><div className="card-title"><Activity size={17}/> Local landmark view</div><span className="status"><i className={`dot${cameraOn ? " teal" : ""}`}/>{cameraStatus}</span></div>
      <div className={`face-preview${prefs.preview ? "" : " preview-hidden"}`}><video ref={videoRef} muted playsInline aria-label="Local webcam preview"/><canvas ref={canvasRef} aria-label="Face landmark mesh overlay"/>{!cameraOn && <div className="face-preview-empty"><CameraOff size={22}/><strong>Camera is off</strong><span>Enable it above after confirming consent.</span></div>} {!prefs.preview && cameraOn && <div className="preview-paused"><EyeOff size={15}/> Preview hidden · local landmark processing continues</div>}</div>
      <div className="face-statusline" role="status"><span className="dot teal"/>{faceStatus}</div>
      <div className="face-movement" aria-live="polite">{!prefs.indicators || !cameraOn ? <span className="smalltext muted">Movement descriptions are disabled.</span> : movements.length ? movements.map((item) => <span className={`pill ${item === "Signal uncertain" ? "uncertain" : ""}`} key={item}>{item}</span>) : <span className="smalltext muted">Waiting for a stable face signal…</span>}</div>
    </section>
    <section className="face-card"><div className="card-title"><ShieldCheck size={17}/> Privacy and processing controls</div><p className="smalltext muted face-subcopy">Camera stays off until you enable it. Settings below are stored in this browser only; landmarks and movement signals are temporary and cleared when you stop the camera or leave this page.</p>
      <Switch label="Camera" description="Explicitly request or stop camera access." checked={cameraOn} onChange={(checked) => checked ? void enableCamera() : stopCamera()} disabled={busy}/>
      <Switch label="Preview" description="Show or hide the webcam preview. Hiding it does not stop local analysis." checked={prefs.preview} onChange={(checked) => setToggle("preview", checked)}/>
      <Switch label="Face mesh" description="Draw the local landmark mesh over the preview." checked={prefs.mesh} onChange={(checked) => setToggle("mesh", checked)} disabled={!cameraOn}/>
      <Switch label="Expression indicators" description="Optionally show smoothed smile-related and brow movement signals. These are not emotions." checked={prefs.indicators} onChange={(checked) => setToggle("indicators", checked)} disabled={!cameraOn}/>
      <Switch label="Share expression summary with my AI companion" description="Off by default. If enabled, you must also press Send summary; only short movement labels go to local Ollama, never frames or landmarks." checked={prefs.shareWithAi} onChange={(checked) => setToggle("shareWithAi", checked)}/>
      <label className="face-frequency"><span><strong>Processing frequency</strong><small>Limit local CPU use · current {prefs.frequency} frames per second</small></span><select className="field-input" value={prefs.frequency} onChange={(event) => updatePrefs({ frequency: Number(event.target.value) })}><option value={2}>2 fps</option><option value={5}>5 fps</option><option value={10}>10 fps</option></select></label>
      {prefs.shareWithAi && cameraOn && <div className="face-share"><p className="smalltext muted">The summary is sent only after you press this button. It is not saved in chat history, memory, journal, exports, or analytics.</p><button className="button primary small" onClick={() => void shareSummary()} disabled={shareBusy || !movements.length}><MessageCircle size={14}/>{shareBusy ? "Asking local AI…" : "Send optional summary to local AI"}</button>{aiReply && <div className="face-ai-reply"><strong>Local companion</strong><p>{aiReply}</p></div>}</div>}
      <div className="row face-privacy-actions"><button className="button small" onClick={clearDerived}><Trash2 size={13}/> Clear local derived data</button><button className="button small" onClick={resetSettings}><RotateCcw size={13}/> Reset settings</button></div>
    </section>
    <p className="face-footnote"><Check size={13}/> MediaPipe Face Landmarker reports 478 landmarks and optional blendshape coefficients. Face Landmarker detection runs in a dedicated worker; only the temporary overlay and cautious movement labels are displayed in this page.</p>
  </div>;
}

function Switch({ label, description, checked, onChange, disabled = false }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void | Promise<void>; disabled?: boolean }) { return <div className="face-setting"><div><strong>{label}</strong><small>{description}</small></div><button className={`switch${checked ? " on" : ""}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => void onChange(!checked)} disabled={disabled}/></div>; }
