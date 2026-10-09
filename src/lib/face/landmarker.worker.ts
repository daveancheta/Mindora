/// <reference lib="webworker" />
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

type WorkerInput =
  | { type: "init"; expressions: boolean }
  | { type: "expressions"; enabled: boolean }
  | { type: "frame"; bitmap: ImageBitmap; timestamp: number; mesh: boolean; expressions: boolean };
let landmarker: FaceLandmarker | null = null;

self.onmessage = async (event: MessageEvent<WorkerInput>) => {
  const message = event.data;
  if (message.type === "init") {
    try {
      const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: "/mediapipe/models/face_landmarker.task", delegate: "CPU" },
        runningMode: "VIDEO", numFaces: 1, minFaceDetectionConfidence: 0.55,
        minFacePresenceConfidence: 0.55, minTrackingConfidence: 0.55,
        outputFaceBlendshapes: message.expressions,
      });
      self.postMessage({ type: "ready" });
    } catch {
      self.postMessage({ type: "error", message: "The local MediaPipe model or WASM runtime could not load. Check the installed local assets and reload this page." });
    }
    return;
  }
  if (message.type === "expressions") {
    if (landmarker) await landmarker.setOptions({ outputFaceBlendshapes: message.enabled });
    return;
  }
  if (!landmarker) { message.bitmap.close(); return; }
  try {
    const result = landmarker.detectForVideo(message.bitmap, message.timestamp);
    const landmarks = result.faceLandmarks[0];
    const categories = message.expressions ? result.faceBlendshapes[0]?.categories.map(({ categoryName, score }) => ({ name: categoryName, score })) ?? [] : [];
    self.postMessage({ type: "result", landmarks: message.mesh ? landmarks?.map(({ x, y }) => ({ x, y })) ?? [] : [], hasFace: Boolean(landmarks?.length), categories });
  } catch {
    self.postMessage({ type: "error", message: "Face detection was interrupted. Try restarting the camera." });
  } finally { message.bitmap.close(); }
};

export {};
