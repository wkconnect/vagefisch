/**
 * Queue Worker Engine for Weighing Tasks
 * 
 * Processes weighing_tasks from the database:
 * 1. Picks up QUEUED tasks
 * 2. Executes route steps (if assigned) or default weighing
 * 3. Updates task status and results
 * 4. Logs events
 */

import { eq, and, sql, desc, lt, isNull, or } from 'drizzle-orm';
import { db } from './db';
import {
  weighingTasks,
  scales,
  routes,
  routeSteps,
  eventsLog,
  metricsSnapshots,
  connectorStatus,
  appSettings,
  type WeighingTask,
  type Scale,
  type RouteStep
} from '../drizzle/schema';
import sicsDriver, { type ScaleConfig, type SicsWeightResponse } from './drivers/sics';

// Worker configuration
interface WorkerConfig {
  concurrency: number;
  pollingIntervalMs: number;
  stuckTimeoutMinutes: number;
  metricsIntervalMs: number;
}

const DEFAULT_CONFIG: WorkerConfig = {
  concurrency: 1,
  pollingIntervalMs: 1000,
  stuckTimeoutMinutes: 10,
  metricsIntervalMs: 30000
};

let workerConfig = { ...DEFAULT_CONFIG };
let isRunning = false;
let activeTaskCount = 0;
let workerStartTime: Date | null = null;

/**
 * Log event to events_log table
 */
async function logEvent(
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
  source: 'QUEUE' | 'SCALE' | 'PRINTER' | 'ONEBOX' | 'API' | 'SYSTEM' | 'AUTH',
  message: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  try {
    await db.insert(eventsLog).values({
      level,
      source,
      message,
      entityType,
      entityId,
      detailsJson: details ? JSON.stringify(details) : null
    });
  } catch (error) {
    console.error('[Worker] Failed to log event:', error);
  }
}

/**
 * Generate unique task ID
 */
function generateTaskId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `T-${timestamp}-${random}`;
}

/**
 * Load worker configuration from app_settings
 */
async function loadConfig(): Promise<WorkerConfig> {
  try {
    const settings = await db.select().from(appSettings);
    const config = { ...DEFAULT_CONFIG };
    
    for (const setting of settings) {
      switch (setting.key) {
        case 'queue.concurrency':
          config.concurrency = parseInt(setting.value || '1', 10);
          break;
        case 'queue.pollingInterval':
          config.pollingIntervalMs = parseInt(setting.value || '1000', 10);
          break;
        case 'queue.stuckTimeout':
          config.stuckTimeoutMinutes = parseInt(setting.value || '10', 10);
          break;
        case 'queue.metricsInterval':
          config.metricsIntervalMs = parseInt(setting.value || '30000', 10);
          break;
      }
    }
    
    return config;
  } catch (error) {
    console.error('[Worker] Failed to load config:', error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Update connector status
 */
async function updateConnectorStatus(
  status: 'running' | 'stopped' | 'error',
  currentTaskId?: string,
  errorMessage?: string
) {
  try {
    const uptime = workerStartTime 
      ? `${Math.floor((Date.now() - workerStartTime.getTime()) / 1000)}s`
      : null;
    
    // Upsert connector status (id=1)
    await db.insert(connectorStatus).values({
      id: 1,
      status,
      version: '1.0.0',
      lastHeartbeat: new Date(),
      uptime,
      currentTaskId,
      errorMessage
    }).onDuplicateKeyUpdate({
      set: {
        status,
        lastHeartbeat: new Date(),
        uptime,
        currentTaskId,
        errorMessage
      }
    });
  } catch (error) {
    console.error('[Worker] Failed to update connector status:', error);
  }
}

/**
 * Get scale configuration for SICS driver
 */
function getScaleConfig(scale: Scale): ScaleConfig {
  return {
    ip: scale.ip,
    port: scale.port,
    protocol: scale.protocol as 'SICS' | 'IND' | 'MT-SICS' | 'CUSTOM',
    readCommand: scale.readCommand || 'SI',
    stableCommand: scale.stableCommand || 'S',
    zeroCommand: scale.zeroCommand || 'Z',
    displayCommand: scale.displayCommand || 'D',
    timeoutMs: 5000
  };
}

/**
 * Execute a single route step
 */
async function executeRouteStep(
  task: WeighingTask,
  step: RouteStep,
  scale: Scale | null
): Promise<{ success: boolean; result?: SicsWeightResponse; error?: string }> {
  const payload = step.payloadJson as Record<string, unknown> | null;
  
  switch (step.actionType) {
    case 'WEIGH':
    case 'WEIGH_STABLE': {
      if (!scale) {
        return { success: false, error: 'No scale assigned to task' };
      }
      const config = getScaleConfig(scale);
      const result = step.actionType === 'WEIGH_STABLE'
        ? await sicsDriver.waitForStableWeight(config, step.timeoutMs || 30000)
        : await sicsDriver.readWeightImmediate(config);
      return { success: result.success, result, error: result.error };
    }
    
    case 'DISPLAY': {
      if (!scale) {
        return { success: false, error: 'No scale assigned to task' };
      }
      const config = getScaleConfig(scale);
      const text = (payload?.text as string) || task.productName || task.sku || '';
      const response = await sicsDriver.displayText(config, text);
      return { success: response.success, error: response.error };
    }
    
    case 'ZERO': {
      if (!scale) {
        return { success: false, error: 'No scale assigned to task' };
      }
      const config = getScaleConfig(scale);
      const response = await sicsDriver.zeroScale(config);
      return { success: response.success, error: response.error };
    }
    
    case 'TARE': {
      if (!scale) {
        return { success: false, error: 'No scale assigned to task' };
      }
      const config = getScaleConfig(scale);
      const tareValue = (payload?.value as number) || parseFloat(task.tare?.toString() || '0');
      const response = await sicsDriver.setTare(config, tareValue);
      return { success: response.success, error: response.error };
    }
    
    case 'WAIT': {
      const waitMs = (payload?.ms as number) || 1000;
      await new Promise(resolve => setTimeout(resolve, waitMs));
      return { success: true };
    }
    
    case 'PRINT': {
      // TODO: Implement printer integration
      await logEvent('INFO', 'QUEUE', `Print step skipped (not implemented)`, 'task', task.taskId);
      return { success: true };
    }
    
    case 'SEND_TO_ONEBOX': {
      // TODO: Implement OneBox integration
      await logEvent('INFO', 'QUEUE', `OneBox step skipped (not configured)`, 'task', task.taskId);
      return { success: true };
    }
    
    case 'CUSTOM': {
      // Custom command execution
      if (!scale || !payload?.command) {
        return { success: false, error: 'Custom command requires scale and command' };
      }
      const config = getScaleConfig(scale);
      try {
        const response = await sicsDriver.sendCommand(config, payload.command as string);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    }
    
    default:
      return { success: false, error: `Unknown action type: ${step.actionType}` };
  }
}

/**
 * Process a single weighing task
 */
async function processTask(task: WeighingTask): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Update task status to RUNNING
    await db.update(weighingTasks)
      .set({ status: 'RUNNING', startedAt: new Date() })
      .where(eq(weighingTasks.id, task.id));
    
    await logEvent('INFO', 'QUEUE', `Task started`, 'task', task.taskId, {
      scaleId: task.scaleId,
      routeId: task.routeId
    });
    
    // Get assigned scale
    let scale: Scale | null = null;
    if (task.scaleId) {
      const [scaleResult] = await db.select().from(scales).where(eq(scales.id, task.scaleId));
      scale = scaleResult || null;
    }
    
    let finalResult: SicsWeightResponse | null = null;
    let lastError: string | null = null;
    
    // Execute route steps if route is assigned
    if (task.routeId) {
      const [route] = await db.select().from(routes).where(eq(routes.id, task.routeId));
      
      if (route && route.isActive) {
        const steps = await db.select()
          .from(routeSteps)
          .where(eq(routeSteps.routeId, task.routeId))
          .orderBy(routeSteps.stepOrder);
        
        for (const step of steps) {
          const stepResult = await executeRouteStep(task, step, scale);
          
          if (!stepResult.success) {
            if (step.onErrorAction === 'STOP') {
              lastError = stepResult.error || 'Step failed';
              break;
            } else if (step.onErrorAction === 'RETRY') {
              // Retry once
              const retryResult = await executeRouteStep(task, step, scale);
              if (!retryResult.success) {
                lastError = retryResult.error || 'Step failed after retry';
                break;
              }
              if (retryResult.result) finalResult = retryResult.result;
            }
            // SKIP - continue to next step
          } else {
            if (stepResult.result) {
              finalResult = stepResult.result;
            }
          }
        }
      }
    } else {
      // Default behavior: just read weight
      if (scale) {
        const config = getScaleConfig(scale);
        finalResult = await sicsDriver.waitForStableWeight(config, 30000);
        if (!finalResult.success) {
          lastError = finalResult.error || 'Failed to read weight';
        }
      } else {
        lastError = 'No scale assigned to task';
      }
    }
    
    // Update task with results
    const duration = Date.now() - startTime;
    
    if (lastError) {
      // Task failed
      const newRetryCount = (task.retryCount || 0) + 1;
      const shouldRetry = newRetryCount < (task.maxRetries || 3);
      
      await db.update(weighingTasks)
        .set({
          status: shouldRetry ? 'QUEUED' : 'FAILED',
          errorMessage: lastError,
          retryCount: newRetryCount,
          rawMessage: finalResult?.rawResponse,
          finishedAt: shouldRetry ? null : new Date()
        })
        .where(eq(weighingTasks.id, task.id));
      
      await logEvent('ERROR', 'QUEUE', `Task failed: ${lastError}`, 'task', task.taskId, {
        duration,
        retryCount: newRetryCount,
        willRetry: shouldRetry
      });
    } else {
      // Task succeeded
      await db.update(weighingTasks)
        .set({
          status: 'DONE',
          resultWeight: finalResult?.weight?.toString(),
          resultNet: finalResult?.weight?.toString(),
          isStable: finalResult?.isStable,
          rawMessage: finalResult?.rawResponse,
          finishedAt: new Date(),
          errorMessage: null
        })
        .where(eq(weighingTasks.id, task.id));
      
      // Update scale last weight
      if (scale && finalResult?.weight !== null) {
        await db.update(scales)
          .set({
            lastWeight: finalResult.weight.toString(),
            lastUnit: finalResult.unit,
            lastSeenAt: new Date(),
            status: 'online',
            lastError: null
          })
          .where(eq(scales.id, scale.id));
      }
      
      await logEvent('INFO', 'QUEUE', `Task completed successfully`, 'task', task.taskId, {
        duration,
        weight: finalResult?.weight,
        unit: finalResult?.unit,
        isStable: finalResult?.isStable
      });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    await db.update(weighingTasks)
      .set({
        status: 'FAILED',
        errorMessage,
        finishedAt: new Date()
      })
      .where(eq(weighingTasks.id, task.id));
    
    await logEvent('ERROR', 'QUEUE', `Task crashed: ${errorMessage}`, 'task', task.taskId);
  }
}

/**
 * Check for stuck tasks and mark them
 */
async function checkStuckTasks(): Promise<void> {
  const stuckThreshold = new Date(Date.now() - workerConfig.stuckTimeoutMinutes * 60 * 1000);
  
  const stuckTasks = await db.select()
    .from(weighingTasks)
    .where(
      and(
        eq(weighingTasks.status, 'RUNNING'),
        lt(weighingTasks.startedAt, stuckThreshold)
      )
    );
  
  for (const task of stuckTasks) {
    await db.update(weighingTasks)
      .set({ status: 'STUCK', errorMessage: 'Task exceeded timeout' })
      .where(eq(weighingTasks.id, task.id));
    
    await logEvent('WARN', 'QUEUE', `Task marked as stuck`, 'task', task.taskId, {
      startedAt: task.startedAt,
      stuckTimeout: workerConfig.stuckTimeoutMinutes
    });
  }
}

/**
 * Collect and save metrics snapshot
 */
async function collectMetrics(): Promise<void> {
  try {
    // Count tasks by status
    const taskCounts = await db.select({
      status: weighingTasks.status,
      count: sql<number>`count(*)`
    })
    .from(weighingTasks)
    .groupBy(weighingTasks.status);
    
    const counts: Record<string, number> = {};
    for (const row of taskCounts) {
      counts[row.status] = row.count;
    }
    
    // Count devices
    const [scaleStats] = await db.select({
      total: sql<number>`count(*)`,
      online: sql<number>`sum(case when status = 'online' then 1 else 0 end)`
    }).from(scales);
    
    // Calculate success rate (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [hourStats] = await db.select({
      total: sql<number>`count(*)`,
      success: sql<number>`sum(case when status = 'DONE' then 1 else 0 end)`,
      failed: sql<number>`sum(case when status = 'FAILED' then 1 else 0 end)`
    })
    .from(weighingTasks)
    .where(sql`finished_at > ${oneHourAgo}`);
    
    const successRate = hourStats.total > 0 
      ? (hourStats.success / hourStats.total * 100).toFixed(2)
      : '0';
    
    // Save metrics snapshot
    await db.insert(metricsSnapshots).values({
      queueDepth: (counts['NEW'] || 0) + (counts['QUEUED'] || 0),
      tasksNew: counts['NEW'] || 0,
      tasksQueued: counts['QUEUED'] || 0,
      tasksRunning: counts['RUNNING'] || 0,
      tasksDone: counts['DONE'] || 0,
      tasksFailed: counts['FAILED'] || 0,
      tasksStuck: counts['STUCK'] || 0,
      successRate,
      tasksLastHour: hourStats.total || 0,
      errorsLastHour: hourStats.failed || 0,
      onlineScales: scaleStats.online || 0,
      totalScales: scaleStats.total || 0,
      uptimeSeconds: workerStartTime 
        ? Math.floor((Date.now() - workerStartTime.getTime()) / 1000)
        : 0
    });
    
  } catch (error) {
    console.error('[Worker] Failed to collect metrics:', error);
  }
}

/**
 * Main worker loop
 */
async function workerLoop(): Promise<void> {
  while (isRunning) {
    try {
      // Check for stuck tasks periodically
      await checkStuckTasks();
      
      // Skip if at capacity
      if (activeTaskCount >= workerConfig.concurrency) {
        await new Promise(resolve => setTimeout(resolve, workerConfig.pollingIntervalMs));
        continue;
      }
      
      // Pick up a QUEUED task (atomic update)
      const [task] = await db.select()
        .from(weighingTasks)
        .where(eq(weighingTasks.status, 'QUEUED'))
        .orderBy(weighingTasks.queuedAt)
        .limit(1);
      
      if (task) {
        activeTaskCount++;
        updateConnectorStatus('running', task.taskId);
        
        // Process task (don't await to allow concurrency)
        processTask(task).finally(() => {
          activeTaskCount--;
          if (activeTaskCount === 0) {
            updateConnectorStatus('running');
          }
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, workerConfig.pollingIntervalMs));
      
    } catch (error) {
      console.error('[Worker] Loop error:', error);
      await logEvent('ERROR', 'SYSTEM', `Worker loop error: ${error}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Metrics collection loop
 */
async function metricsLoop(): Promise<void> {
  while (isRunning) {
    await collectMetrics();
    await new Promise(resolve => setTimeout(resolve, workerConfig.metricsIntervalMs));
  }
}

/**
 * Start the worker
 */
export async function startWorker(): Promise<void> {
  if (isRunning) {
    console.log('[Worker] Already running');
    return;
  }
  
  console.log('[Worker] Starting...');
  isRunning = true;
  workerStartTime = new Date();
  
  // Load configuration
  workerConfig = await loadConfig();
  console.log('[Worker] Config loaded:', workerConfig);
  
  // Update status
  await updateConnectorStatus('running');
  await logEvent('INFO', 'SYSTEM', 'Worker started', undefined, undefined, { config: workerConfig });
  
  // Start loops
  workerLoop();
  metricsLoop();
  
  console.log('[Worker] Started successfully');
}

/**
 * Stop the worker
 */
export async function stopWorker(): Promise<void> {
  console.log('[Worker] Stopping...');
  isRunning = false;
  
  // Wait for active tasks to complete (with timeout)
  const timeout = Date.now() + 30000;
  while (activeTaskCount > 0 && Date.now() < timeout) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  await updateConnectorStatus('stopped');
  await logEvent('INFO', 'SYSTEM', 'Worker stopped');
  
  console.log('[Worker] Stopped');
}

/**
 * Create a new weighing task
 */
export async function createWeighingTask(params: {
  scaleId?: number;
  printerId?: number;
  routeId?: number;
  externalRef?: string;
  sku?: string;
  productName?: string;
  batch?: string;
  targetWeight?: number;
  minWeight?: number;
  maxWeight?: number;
  tare?: number;
  unit?: string;
}): Promise<string> {
  const taskId = generateTaskId();
  
  await db.insert(weighingTasks).values({
    taskId,
    status: 'QUEUED',
    queuedAt: new Date(),
    ...params
  });
  
  await logEvent('INFO', 'QUEUE', `Task created`, 'task', taskId, params);
  
  return taskId;
}

/**
 * Retry a failed/stuck task
 */
export async function retryTask(taskId: string): Promise<boolean> {
  const [task] = await db.select()
    .from(weighingTasks)
    .where(eq(weighingTasks.taskId, taskId));
  
  if (!task || !['FAILED', 'STUCK', 'CANCELLED'].includes(task.status)) {
    return false;
  }
  
  await db.update(weighingTasks)
    .set({
      status: 'QUEUED',
      queuedAt: new Date(),
      startedAt: null,
      finishedAt: null,
      errorMessage: null
    })
    .where(eq(weighingTasks.taskId, taskId));
  
  await logEvent('INFO', 'QUEUE', `Task queued for retry`, 'task', taskId);
  
  return true;
}

/**
 * Cancel a task
 */
export async function cancelTask(taskId: string): Promise<boolean> {
  const [task] = await db.select()
    .from(weighingTasks)
    .where(eq(weighingTasks.taskId, taskId));
  
  if (!task || ['DONE', 'CANCELLED'].includes(task.status)) {
    return false;
  }
  
  await db.update(weighingTasks)
    .set({
      status: 'CANCELLED',
      finishedAt: new Date()
    })
    .where(eq(weighingTasks.taskId, taskId));
  
  await logEvent('INFO', 'QUEUE', `Task cancelled`, 'task', taskId);
  
  return true;
}

/**
 * Get worker status
 */
export function getWorkerStatus() {
  return {
    isRunning,
    activeTaskCount,
    startTime: workerStartTime,
    config: workerConfig
  };
}

export default {
  startWorker,
  stopWorker,
  createWeighingTask,
  retryTask,
  cancelTask,
  getWorkerStatus
};
