import { eq, desc, and, sql, gte, lte, or, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import {
  localUsers,
  scales,
  printers,
  routes,
  routeSteps,
  weighingTasks,
  appSettings,
  oneboxSettings,
  telegramSettings,
  eventsLog,
  metricsSnapshots,
  connectorStatus,
  logs,
  queueTasks,
  type LocalUser,
  type Scale,
  type Printer,
  type Route,
  type RouteStep,
  type WeighingTask,
  type AppSetting,
  type OneboxSetting,
  type TelegramSetting,
  type EventLog,
  type MetricsSnapshot,
  type ConnectorStatus,
  type Log,
  type QueueTask,
} from '../drizzle/schema';

// Database connection
const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
});

export const db = drizzle(pool);

// ==================== LOCAL USERS ====================
export async function getUserByUsername(username: string): Promise<LocalUser | undefined> {
  const [user] = await db.select().from(localUsers).where(eq(localUsers.username, username));
  return user;
}

export async function getUserById(id: number): Promise<LocalUser | undefined> {
  const [user] = await db.select().from(localUsers).where(eq(localUsers.id, id));
  return user;
}

// ==================== SCALES ====================
export async function getAllScales(): Promise<Scale[]> {
  return await db.select().from(scales).orderBy(scales.name);
}

export async function getScaleById(id: number): Promise<Scale | undefined> {
  const [scale] = await db.select().from(scales).where(eq(scales.id, id));
  return scale;
}

export async function createScale(data: Partial<Scale>): Promise<number> {
  const [result] = await db.insert(scales).values(data as any);
  return result.insertId;
}

export async function updateScale(id: number, data: Partial<Scale>): Promise<void> {
  await db.update(scales).set(data).where(eq(scales.id, id));
}

export async function deleteScale(id: number): Promise<void> {
  await db.delete(scales).where(eq(scales.id, id));
}

export async function updateScaleStatus(id: number, status: string, error?: string): Promise<void> {
  await db.update(scales).set({
    status: status as any,
    lastSeenAt: status === 'online' ? new Date() : undefined,
    lastError: error || null,
  }).where(eq(scales.id, id));
}

export async function updateScaleLastWeight(id: number, weight: number, unit: string): Promise<void> {
  await db.update(scales).set({
    lastWeight: weight.toString(),
    lastUnit: unit,
    lastSeenAt: new Date(),
  }).where(eq(scales.id, id));
}

// ==================== PRINTERS ====================
export async function getAllPrinters(): Promise<Printer[]> {
  return await db.select().from(printers).orderBy(printers.name);
}

export async function getPrinterById(id: number): Promise<Printer | undefined> {
  const [printer] = await db.select().from(printers).where(eq(printers.id, id));
  return printer;
}

export async function createPrinter(data: Partial<Printer>): Promise<number> {
  const [result] = await db.insert(printers).values(data as any);
  return result.insertId;
}

export async function updatePrinter(id: number, data: Partial<Printer>): Promise<void> {
  await db.update(printers).set(data).where(eq(printers.id, id));
}

export async function deletePrinter(id: number): Promise<void> {
  await db.delete(printers).where(eq(printers.id, id));
}

export async function updatePrinterStatus(id: number, status: string, error?: string): Promise<void> {
  await db.update(printers).set({
    status: status as any,
    lastSeenAt: status === 'online' ? new Date() : undefined,
    lastError: error || null,
  }).where(eq(printers.id, id));
}

// ==================== ROUTES ====================
export async function getAllRoutes(): Promise<Route[]> {
  return await db.select().from(routes).orderBy(routes.name);
}

export async function getRouteById(id: number): Promise<Route | undefined> {
  const [route] = await db.select().from(routes).where(eq(routes.id, id));
  return route;
}

export async function createRoute(data: Partial<Route>): Promise<number> {
  const [result] = await db.insert(routes).values(data as any);
  return result.insertId;
}

export async function updateRoute(id: number, data: Partial<Route>): Promise<void> {
  await db.update(routes).set(data).where(eq(routes.id, id));
}

export async function deleteRoute(id: number): Promise<void> {
  // Delete steps first
  await db.delete(routeSteps).where(eq(routeSteps.routeId, id));
  await db.delete(routes).where(eq(routes.id, id));
}

export async function clearDefaultRoutes(): Promise<void> {
  await db.update(routes).set({ isDefault: false }).where(eq(routes.isDefault, true));
}

export async function getDefaultRoute(): Promise<Route | undefined> {
  const [route] = await db.select().from(routes).where(eq(routes.isDefault, true));
  return route;
}

// ==================== ROUTE STEPS ====================
export async function getRouteSteps(routeId: number): Promise<RouteStep[]> {
  return await db.select().from(routeSteps)
    .where(eq(routeSteps.routeId, routeId))
    .orderBy(routeSteps.stepOrder);
}

export async function createRouteStep(data: Partial<RouteStep>): Promise<number> {
  const [result] = await db.insert(routeSteps).values(data as any);
  return result.insertId;
}

export async function updateRouteStep(id: number, data: Partial<RouteStep>): Promise<void> {
  await db.update(routeSteps).set(data).where(eq(routeSteps.id, id));
}

export async function deleteRouteStep(id: number): Promise<void> {
  await db.delete(routeSteps).where(eq(routeSteps.id, id));
}

// ==================== WEIGHING TASKS ====================
export async function getWeighingTasks(params: {
  page?: number;
  limit?: number;
  status?: string;
  scaleId?: number;
  dateFrom?: string;
  dateTo?: string;
}): Promise<{ tasks: WeighingTask[]; total: number }> {
  const { page = 1, limit = 50, status, scaleId, dateFrom, dateTo } = params;
  const offset = (page - 1) * limit;
  
  const conditions = [];
  if (status) conditions.push(eq(weighingTasks.status, status as any));
  if (scaleId) conditions.push(eq(weighingTasks.scaleId, scaleId));
  if (dateFrom) conditions.push(gte(weighingTasks.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(weighingTasks.createdAt, new Date(dateTo)));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [tasks, [countResult]] = await Promise.all([
    db.select().from(weighingTasks)
      .where(whereClause)
      .orderBy(desc(weighingTasks.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(weighingTasks).where(whereClause),
  ]);
  
  return { tasks, total: countResult.count };
}

export async function getWeighingTaskById(id: number): Promise<WeighingTask | undefined> {
  const [task] = await db.select().from(weighingTasks).where(eq(weighingTasks.id, id));
  return task;
}

export async function getWeighingTaskByTaskId(taskId: string): Promise<WeighingTask | undefined> {
  const [task] = await db.select().from(weighingTasks).where(eq(weighingTasks.taskId, taskId));
  return task;
}

export async function createWeighingTask(data: Partial<WeighingTask>): Promise<number> {
  const [result] = await db.insert(weighingTasks).values(data as any);
  return result.insertId;
}

export async function updateWeighingTask(id: number, data: Partial<WeighingTask>): Promise<void> {
  await db.update(weighingTasks).set(data).where(eq(weighingTasks.id, id));
}

export async function getWeighingTaskStats(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  todayCount: number;
  successRate: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [statusCounts, [todayResult], [successResult]] = await Promise.all([
    db.select({
      status: weighingTasks.status,
      count: sql<number>`count(*)`
    }).from(weighingTasks).groupBy(weighingTasks.status),
    
    db.select({ count: sql<number>`count(*)` })
      .from(weighingTasks)
      .where(gte(weighingTasks.createdAt, today)),
    
    db.select({
      total: sql<number>`count(*)`,
      success: sql<number>`sum(case when status = 'DONE' then 1 else 0 end)`
    }).from(weighingTasks)
      .where(gte(weighingTasks.finishedAt, new Date(Date.now() - 24 * 60 * 60 * 1000))),
  ]);
  
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of statusCounts) {
    byStatus[row.status] = row.count;
    total += row.count;
  }
  
  const successRate = successResult.total > 0 
    ? (successResult.success / successResult.total) * 100 
    : 0;
  
  return {
    total,
    byStatus,
    todayCount: todayResult.count,
    successRate: Math.round(successRate * 100) / 100,
  };
}

// ==================== APP SETTINGS ====================
export async function getAllSettings(): Promise<AppSetting[]> {
  return await db.select().from(appSettings).orderBy(appSettings.key);
}

export async function getSetting(key: string): Promise<AppSetting | undefined> {
  const [setting] = await db.select().from(appSettings).where(eq(appSettings.key, key));
  return setting;
}

export async function setSetting(key: string, value: string, description?: string): Promise<void> {
  await db.insert(appSettings).values({ key, value, description })
    .onDuplicateKeyUpdate({ set: { value, description } });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, key));
}

// ==================== ONEBOX SETTINGS ====================
export async function getOneboxSettings(): Promise<OneboxSetting | undefined> {
  const [settings] = await db.select().from(oneboxSettings).limit(1);
  return settings;
}

export async function saveOneboxSettings(data: Partial<OneboxSetting>): Promise<void> {
  const existing = await getOneboxSettings();
  if (existing) {
    await db.update(oneboxSettings).set(data).where(eq(oneboxSettings.id, existing.id));
  } else {
    await db.insert(oneboxSettings).values(data as any);
  }
}

// ==================== TELEGRAM SETTINGS ====================
export async function getTelegramSettings(): Promise<TelegramSetting | undefined> {
  const [settings] = await db.select().from(telegramSettings).limit(1);
  return settings;
}

export async function saveTelegramSettings(data: Partial<TelegramSetting>): Promise<void> {
  const existing = await getTelegramSettings();
  if (existing) {
    await db.update(telegramSettings).set(data).where(eq(telegramSettings.id, existing.id));
  } else {
    await db.insert(telegramSettings).values(data as any);
  }
}

// ==================== EVENTS LOG ====================
export async function createEventLog(data: Partial<EventLog>): Promise<void> {
  await db.insert(eventsLog).values(data as any);
}

export async function getEvents(params: {
  page?: number;
  limit?: number;
  level?: string;
  source?: string;
  entityType?: string;
  entityId?: string;
}): Promise<{ events: EventLog[]; total: number }> {
  const { page = 1, limit = 50, level, source, entityType, entityId } = params;
  const offset = (page - 1) * limit;
  
  const conditions = [];
  if (level) conditions.push(eq(eventsLog.level, level as any));
  if (source) conditions.push(eq(eventsLog.source, source as any));
  if (entityType) conditions.push(eq(eventsLog.entityType, entityType));
  if (entityId) conditions.push(eq(eventsLog.entityId, entityId));
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [events, [countResult]] = await Promise.all([
    db.select().from(eventsLog)
      .where(whereClause)
      .orderBy(desc(eventsLog.ts))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(eventsLog).where(whereClause),
  ]);
  
  return { events, total: countResult.count };
}

export async function getRecentEvents(limit: number, source?: string): Promise<EventLog[]> {
  const whereClause = source ? eq(eventsLog.source, source as any) : undefined;
  return await db.select().from(eventsLog)
    .where(whereClause)
    .orderBy(desc(eventsLog.ts))
    .limit(limit);
}

// ==================== METRICS SNAPSHOTS ====================
export async function getLatestMetrics(): Promise<MetricsSnapshot | undefined> {
  const [metrics] = await db.select().from(metricsSnapshots)
    .orderBy(desc(metricsSnapshots.ts))
    .limit(1);
  return metrics;
}

export async function getMetricsHistory(hours: number): Promise<MetricsSnapshot[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return await db.select().from(metricsSnapshots)
    .where(gte(metricsSnapshots.ts, since))
    .orderBy(metricsSnapshots.ts);
}

export async function createMetricsSnapshot(data: Partial<MetricsSnapshot>): Promise<void> {
  await db.insert(metricsSnapshots).values(data as any);
}

// ==================== CONNECTOR STATUS ====================
export async function getConnectorStatus(): Promise<ConnectorStatus | undefined> {
  const [status] = await db.select().from(connectorStatus).limit(1);
  return status;
}

export async function updateConnectorStatus(data: Partial<ConnectorStatus>): Promise<void> {
  const existing = await getConnectorStatus();
  if (existing) {
    await db.update(connectorStatus).set(data).where(eq(connectorStatus.id, existing.id));
  } else {
    await db.insert(connectorStatus).values({ id: 1, ...data } as any);
  }
}

// ==================== LOGS (legacy) ====================
export async function createLog(data: {
  level: string;
  source: string;
  message: string;
  entityType?: string;
  entityId?: number;
  metaJson?: object | null;
}): Promise<void> {
  await db.insert(logs).values({
    level: data.level as any,
    source: data.source,
    message: data.message,
    entityType: data.entityType,
    entityId: data.entityId,
    metaJson: data.metaJson ? JSON.stringify(data.metaJson) : null,
  });
}

export async function getLogs(params: {
  page?: number;
  limit?: number;
  level?: string;
  source?: string;
  search?: string;
}): Promise<{ logs: Log[]; total: number }> {
  const { page = 1, limit = 50, level, source, search } = params;
  const offset = (page - 1) * limit;
  
  const conditions = [];
  if (level) conditions.push(eq(logs.level, level as any));
  if (source) conditions.push(eq(logs.source, source));
  if (search) conditions.push(sql`message LIKE ${`%${search}%`}`);
  
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  
  const [logList, [countResult]] = await Promise.all([
    db.select().from(logs)
      .where(whereClause)
      .orderBy(desc(logs.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(logs).where(whereClause),
  ]);
  
  return { logs: logList, total: countResult.count };
}

export async function getRecentErrors(limit: number): Promise<Log[]> {
  return await db.select().from(logs)
    .where(eq(logs.level, 'error'))
    .orderBy(desc(logs.createdAt))
    .limit(limit);
}

// ==================== QUEUE TASKS (legacy) ====================
export async function getAllQueueTasks(status?: string): Promise<QueueTask[]> {
  const whereClause = status ? eq(queueTasks.status, status as any) : undefined;
  return await db.select().from(queueTasks)
    .where(whereClause)
    .orderBy(desc(queueTasks.createdAt));
}

export async function getQueueTaskById(id: number): Promise<QueueTask | undefined> {
  const [task] = await db.select().from(queueTasks).where(eq(queueTasks.id, id));
  return task;
}

export async function retryQueueTask(id: number): Promise<void> {
  await db.update(queueTasks).set({
    status: 'pending',
    retries: sql`retries + 1`,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
  }).where(eq(queueTasks.id, id));
}

export async function cancelQueueTask(id: number): Promise<void> {
  await db.update(queueTasks).set({
    status: 'cancelled',
    finishedAt: new Date(),
  }).where(eq(queueTasks.id, id));
}

export async function getQueueStats(): Promise<{
  pending: number;
  active: number;
  completed: number;
  failed: number;
  stuck: number;
}> {
  const counts = await db.select({
    status: queueTasks.status,
    count: sql<number>`count(*)`
  }).from(queueTasks).groupBy(queueTasks.status);
  
  const stats = { pending: 0, active: 0, completed: 0, failed: 0, stuck: 0 };
  for (const row of counts) {
    if (row.status === 'pending') stats.pending = row.count;
    else if (row.status === 'running') stats.active = row.count;
    else if (row.status === 'completed') stats.completed = row.count;
    else if (row.status === 'failed') stats.failed = row.count;
    else if (row.status === 'stuck') stats.stuck = row.count;
  }
  
  return stats;
}

export default {
  db,
  // Users
  getUserByUsername,
  getUserById,
  // Scales
  getAllScales,
  getScaleById,
  createScale,
  updateScale,
  deleteScale,
  updateScaleStatus,
  updateScaleLastWeight,
  // Printers
  getAllPrinters,
  getPrinterById,
  createPrinter,
  updatePrinter,
  deletePrinter,
  updatePrinterStatus,
  // Routes
  getAllRoutes,
  getRouteById,
  createRoute,
  updateRoute,
  deleteRoute,
  clearDefaultRoutes,
  getDefaultRoute,
  // Route Steps
  getRouteSteps,
  createRouteStep,
  updateRouteStep,
  deleteRouteStep,
  // Weighing Tasks
  getWeighingTasks,
  getWeighingTaskById,
  getWeighingTaskByTaskId,
  createWeighingTask,
  updateWeighingTask,
  getWeighingTaskStats,
  // Settings
  getAllSettings,
  getSetting,
  setSetting,
  deleteSetting,
  getOneboxSettings,
  saveOneboxSettings,
  getTelegramSettings,
  saveTelegramSettings,
  // Events
  createEventLog,
  getEvents,
  getRecentEvents,
  // Metrics
  getLatestMetrics,
  getMetricsHistory,
  createMetricsSnapshot,
  // Connector
  getConnectorStatus,
  updateConnectorStatus,
  // Logs (legacy)
  createLog,
  getLogs,
  getRecentErrors,
  // Queue (legacy)
  getAllQueueTasks,
  getQueueTaskById,
  retryQueueTask,
  cancelQueueTask,
  getQueueStats,
};

// ==================== USER MANAGEMENT ====================
export async function updateLastLogin(userId: number): Promise<void> {
  await db.update(localUsers).set({ updatedAt: new Date() }).where(eq(localUsers.id, userId));
}

export async function hasAnyUsers(): Promise<boolean> {
  const [result] = await db.select({ count: sql<number>`count(*)` }).from(localUsers);
  return result.count > 0;
}

export async function createUser(data: { username: string; passwordHash: string; name?: string; role?: string }): Promise<number> {
  const [result] = await db.insert(localUsers).values({
    username: data.username,
    passwordHash: data.passwordHash,
    name: data.name,
    role: (data.role || 'viewer') as any,
  });
  return result.insertId;
}
