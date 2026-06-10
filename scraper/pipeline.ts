import { randomUUID } from "crypto";

import { runPrepare } from "./prepare.js";
import { runScrape } from "./scrape.js";
import { runUpload } from "./upload.js";
import type {
  ApiStatus,
  PipelineEnqueueResponse,
  PipelineRunRequest,
  RunStatusResponse,
  StopPipelineResponse,
} from "./types.js";

type PipelineStatus = "queued" | "running" | "succeeded" | "failed" | "aborted";

type PipelineRunState = {
  runId: string;
  request: PipelineRunRequest;
  status: PipelineStatus;
  currentStep: "scrape" | "prepare" | "upload" | null;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  stopped: boolean;
  jobId: number;
  stepResponses: {
    scrape?: ApiStatus | null;
    prepare?: ApiStatus | null;
    upload?: ApiStatus | null;
  };
};

const runs = new Map<string, PipelineRunState>();
let jobCounter = 1;

export function enqueuePipelineRun(request: PipelineRunRequest): PipelineEnqueueResponse {
  const runId = makePipelineRunId();
  const state: PipelineRunState = {
    runId,
    request,
    status: "queued",
    currentStep: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
    stopped: false,
    jobId: jobCounter++,
    stepResponses: {},
  };
  runs.set(runId, state);

  void executePipeline(state);

  return {
    ok: true,
    run_id: runId,
    procrastinate_job_id: state.jobId,
    message: "enqueued",
  };
}

export function getPipelineRunStatus(runId: string): RunStatusResponse {
  const state = runs.get(runId);
  if (!state) {
    throw Object.assign(new Error(`Run not found: ${runId}`), { status: 404 });
  }
  return toRunStatusResponse(state);
}

export function stopPipelineRun(runId: string): StopPipelineResponse {
  const state = runs.get(runId);
  if (!state) {
    throw Object.assign(new Error(`Run not found: ${runId}`), { status: 404 });
  }

  state.stopped = true;
  if (state.status === "queued" || state.status === "running") {
    state.status = "aborted";
    state.finishedAt = new Date().toISOString();
    state.error = "Stop requested";
  }

  return {
    ok: true,
    run_id: runId,
    cancel_file: `memory://${runId}/cancel`,
    procrastinate_job_id: state.jobId,
  };
}

async function executePipeline(state: PipelineRunState) {
  state.status = "running";

  try {
    ensureNotStopped(state);
    state.currentStep = "scrape";
    const scrape = await runScrape(state.request.scrape, { runId: state.runId });
    state.stepResponses.scrape = scrape;

    ensureNotStopped(state);
    state.currentStep = "prepare";
    const prepare = await runPrepare({
      ...state.request.prepare,
      run_id: state.runId,
      input_pages_dir: stringOutput(scrape, "pages_dir") ?? state.request.prepare.input_pages_dir ?? null,
    });
    state.stepResponses.prepare = prepare;

    ensureNotStopped(state);
    state.currentStep = "upload";
    const upload = await runUpload({
      ...state.request.upload,
      run_id: state.runId,
      ingestion_dir: stringOutput(prepare, "ingestion_dir") ?? state.request.upload.ingestion_dir ?? null,
    });
    state.stepResponses.upload = upload;

    state.status = "succeeded";
    state.currentStep = null;
    state.finishedAt = new Date().toISOString();
  } catch (error) {
    if (state.stopped) {
      state.status = "aborted";
      state.error = error instanceof Error ? error.message : "Pipeline run aborted";
      state.finishedAt = state.finishedAt ?? new Date().toISOString();
    } else {
      state.status = "failed";
      state.error = error instanceof Error ? error.message : "Pipeline failed";
      state.finishedAt = new Date().toISOString();
    }
  } finally {
    await notifyCallback(state);
  }
}

function ensureNotStopped(state: PipelineRunState) {
  if (!state.stopped) return;
  state.status = "aborted";
  state.finishedAt = new Date().toISOString();
  throw new Error("Pipeline run aborted");
}

async function notifyCallback(state: PipelineRunState) {
  const callbackUrl = state.request.callback_url?.trim();
  if (!callbackUrl) return;

  try {
    await fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toRunStatusResponse(state)),
    });
  } catch {
    // Callback is best-effort; the app also polls GET /runs/:id.
  }
}

function toRunStatusResponse(state: PipelineRunState): RunStatusResponse {
  const liveNamespace =
    state.stepResponses.upload?.live_namespace ??
    stringOutput(state.stepResponses.upload ?? null, "live_namespace") ??
    null;

  return {
    ok: true,
    run_id: state.runId,
    state_path: `memory://${state.runId}`,
    state: {
      pipeline_status: state.status,
      current_step: state.currentStep,
      started_at: state.startedAt,
      finished_at: state.finishedAt,
      error: state.error,
    },
    pipeline: {
      status: state.status,
      started_at: state.startedAt,
      finished_at: state.finishedAt,
      error: state.error,
    },
    current_step: state.currentStep,
    pipeline_status: state.status,
    live_namespace: liveNamespace,
    step_responses: {
      scrape: state.stepResponses.scrape ?? null,
      prepare: state.stepResponses.prepare ?? null,
      upload: state.stepResponses.upload ?? null,
    },
    scrape: state.stepResponses.scrape ?? null,
    prepare: state.stepResponses.prepare ?? null,
    upload: state.stepResponses.upload ?? null,
    paths: {
      scrape_output_dir: stringOutput(state.stepResponses.scrape ?? null, "output_dir"),
      pages_dir: stringOutput(state.stepResponses.scrape ?? null, "pages_dir"),
      ingestion_dir: stringOutput(state.stepResponses.prepare ?? null, "ingestion_dir"),
    },
  };
}

function stringOutput(status: ApiStatus | null, key: string) {
  const value = status?.outputs?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function makePipelineRunId() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `kb-${timestamp}-${randomUUID()}`;
}
