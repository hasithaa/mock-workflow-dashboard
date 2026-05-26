import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Connection, Client } from '@temporalio/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'temporal.config.json');

let config;
let temporalClient;

async function loadConfig() {
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  config = JSON.parse(raw);
  console.log(`[config] ${config.address}  ns: ${config.namespace}`);
  return config;
}

async function createClient(cfg) {
  const connOptions = { address: cfg.address };
  if (cfg.tls?.enabled) {
    connOptions.tls = {};
    if (cfg.tls.clientCertPath) {
      connOptions.tls.clientCertPair = {
        crt: readFileSync(cfg.tls.clientCertPath),
        key: readFileSync(cfg.tls.clientKeyPath),
      };
    }
    if (cfg.tls.serverRootCACertPath) {
      connOptions.tls.serverRootCACertificate = readFileSync(cfg.tls.serverRootCACertPath);
    }
  }
  const connection = await Connection.connect(connOptions);
  return new Client({ connection, namespace: cfg.namespace });
}

// ---- helpers ----
function statusName(status) {
  if (status == null) return 'Unknown';
  if (typeof status === 'object') {
    const rawName = status.name ?? '';
    if (rawName) {
      const clean = rawName.replace('WORKFLOW_EXECUTION_STATUS_', '');
      return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
        .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    }
    status = Number(status.code ?? 0);
  }
  if (typeof status === 'string') {
    const clean = status.replace('WORKFLOW_EXECUTION_STATUS_', '');
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
      .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }
  const MAP = {
    0: 'Unspecified', 1: 'Running', 2: 'Completed', 3: 'Failed',
    4: 'Canceled', 5: 'Terminated', 6: 'ContinuedAsNew', 7: 'TimedOut',
  };
  return MAP[Number(status)] ?? `Unknown(${status})`;
}

function decodePayloads(payloads) {
  if (!payloads?.length) return null;
  const results = payloads.map(p => {
    if (!p?.data?.length) return null;
    const encoding = p.metadata?.encoding
      ? Buffer.from(p.metadata.encoding).toString('utf-8')
      : '';
    if (encoding === 'binary/null') return null;
    const str = Buffer.from(p.data).toString('utf-8');
    try { return JSON.parse(str); } catch { return str; }
  });
  return results.length === 1 ? results[0] : results;
}

function formatExecution(exec) {
  return {
    workflowId: exec.execution?.workflowId ?? '',
    runId: exec.execution?.runId ?? '',
    workflowType: exec.type?.name ?? '',
    status: statusName(exec.status),
    startTime: exec.startTime ? new Date(Number(exec.startTime.seconds) * 1000).toISOString() : null,
    closeTime: exec.closeTime ? new Date(Number(exec.closeTime.seconds) * 1000).toISOString() : null,
    taskQueue: exec.taskQueue ?? '',
    historyLength: Number(exec.historyLength ?? 0),
  };
}

function formatHistoryEvent(event) {
  return {
    eventId: Number(event.eventId ?? 0),
    eventType: event.eventType,
    eventTime: event.eventTime ? new Date(Number(event.eventTime.seconds) * 1000).toISOString() : null,
  };
}

// ---- Express app ----
const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/config', (_req, res) => {
  res.json({
    address: config.address,
    namespace: config.namespace,
    tls: { enabled: config.tls?.enabled ?? false },
  });
});

app.get('/api/workflow-types', async (_req, res) => {
  try {
    const types = new Set();
    let nextPageToken;
    do {
      const resp = await temporalClient.workflowService.listWorkflowExecutions({
        namespace: config.namespace,
        pageSize: 100,
        query: '',
        nextPageToken,
      });
      for (const exec of resp.executions ?? []) {
        if (exec.type?.name) types.add(exec.type.name);
      }
      nextPageToken = resp.nextPageToken?.length ? resp.nextPageToken : undefined;
    } while (nextPageToken && types.size < 200);
    res.json({ workflowTypes: Array.from(types).sort() });
  } catch (err) {
    console.error('[workflow-types]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Flexible search: workflowType, workflowId, status, startTimeFrom, startTimeTo
app.get('/api/workflows', async (req, res) => {
  const {
    workflowType, workflowId, status,
    startTimeFrom, startTimeTo,
    pageSize = 30,
    nextPageToken: tokenParam,
  } = req.query;

  try {
    const conditions = [];
    if (workflowType) conditions.push(`WorkflowType = "${workflowType}"`);
    if (workflowId) conditions.push(`WorkflowId = "${workflowId}"`);
    if (status && status !== 'All') conditions.push(`ExecutionStatus = "${status}"`);
    if (startTimeFrom) conditions.push(`StartTime >= "${new Date(startTimeFrom).toISOString()}"`);
    if (startTimeTo) conditions.push(`StartTime <= "${new Date(startTimeTo + 'T23:59:59').toISOString()}"`);

    const query = conditions.join(' AND ');
    const resp = await temporalClient.workflowService.listWorkflowExecutions({
      namespace: config.namespace,
      pageSize: Number(pageSize),
      query,
      nextPageToken: tokenParam ? Buffer.from(tokenParam, 'base64') : undefined,
    });

    const executions = (resp.executions ?? []).map(formatExecution);
    const nextToken = resp.nextPageToken?.length
      ? Buffer.from(resp.nextPageToken).toString('base64')
      : null;

    res.json({ executions, nextPageToken: nextToken });
  } catch (err) {
    console.error('[workflows]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/workflows/:workflowId/:runId', async (req, res) => {
  const { workflowId, runId } = req.params;
  try {
    const handle = temporalClient.workflow.getHandle(workflowId, runId);
    const [desc, history] = await Promise.all([
      handle.describe(),
      handle.fetchHistory(),
    ]);

    let input = null;
    let output = null;
    let failureInfo = null;

    for (const event of history.events ?? []) {
      if (event.workflowExecutionStartedEventAttributes) {
        input = decodePayloads(event.workflowExecutionStartedEventAttributes.input?.payloads);
      }
      if (event.workflowExecutionCompletedEventAttributes) {
        output = decodePayloads(event.workflowExecutionCompletedEventAttributes.result?.payloads);
      }
      if (event.workflowExecutionFailedEventAttributes) {
        const f = event.workflowExecutionFailedEventAttributes.failure;
        failureInfo = {
          message: f?.message,
          type: f?.applicationFailureInfo?.type ?? 'ApplicationError',
        };
      }
    }

    const historyEvents = (history.events ?? []).slice(0, 100).map(formatHistoryEvent);

    res.json({
      workflowId,
      runId,
      workflowType: desc.type,
      status: statusName(desc.status),
      startTime: desc.startTime?.toISOString?.() ?? null,
      closeTime: desc.closeTime?.toISOString?.() ?? null,
      taskQueue: desc.taskQueue,
      historyLength: Number(desc.historyLength ?? 0),
      input,
      output,
      failureInfo,
      historyEvents,
    });
  } catch (err) {
    console.error('[workflow-detail]', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
(async () => {
  try {
    config = await loadConfig();
    temporalClient = await createClient(config);
    console.log('[temporal] Connected to', config.address);
    app.listen(PORT, () => console.log(`[server] http://localhost:${PORT}`));
  } catch (err) {
    console.error('[startup] Failed:', err.message);
    process.exit(1);
  }
})();
