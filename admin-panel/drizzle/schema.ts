import {
  mysqlTable,
  varchar,
  int,
  text,
  boolean,
  timestamp,
  mysqlEnum,
  json,
  decimal,
  bigint,
} from "drizzle-orm/mysql-core";

// ============================================================================
// LOCAL USERS (existing)
// ============================================================================
export const localUsers = mysqlTable("local_users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  role: mysqlEnum("role", ["admin", "viewer"]).default("viewer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LocalUser = typeof localUsers.$inferSelect;
export type InsertLocalUser = typeof localUsers.$inferInsert;

// ============================================================================
// SCALES (existing, enhanced)
// ============================================================================
export const scales = mysqlTable("scales", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  ip: varchar("ip", { length: 45 }).notNull(),
  port: int("port").notNull().default(4001),
  protocol: mysqlEnum("protocol", ["SICS", "IND", "MT-SICS", "CUSTOM"]).default("SICS").notNull(),
  // SICS command templates (configurable per scale model)
  readCommand: varchar("read_command", { length: 32 }).default("SI"),
  stableCommand: varchar("stable_command", { length: 32 }).default("S"),
  zeroCommand: varchar("zero_command", { length: 32 }).default("Z"),
  displayCommand: varchar("display_command", { length: 32 }).default("D"),
  enabled: boolean("enabled").default(true).notNull(),
  status: mysqlEnum("status", ["online", "offline", "error", "unknown"]).default("unknown").notNull(),
  lastSeenAt: timestamp("last_seen_at"),
  lastWeight: decimal("last_weight", { precision: 10, scale: 3 }),
  lastUnit: varchar("last_unit", { length: 8 }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Scale = typeof scales.$inferSelect;
export type InsertScale = typeof scales.$inferInsert;

// ============================================================================
// PRINTERS (existing)
// ============================================================================
export const printers = mysqlTable("printers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
  ip: varchar("ip", { length: 45 }).notNull(),
  port: int("port").notNull().default(9100),
  protocol: mysqlEnum("protocol", ["ZPL", "RAW", "IPP", "CUSTOM"]).default("ZPL").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  status: mysqlEnum("status", ["online", "offline", "error", "unknown"]).default("unknown").notNull(),
  lastSeenAt: timestamp("last_seen_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Printer = typeof printers.$inferSelect;
export type InsertPrinter = typeof printers.$inferInsert;

// ============================================================================
// ROUTES - Workflow definitions
// ============================================================================
export const routes = mysqlTable("routes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Route = typeof routes.$inferSelect;
export type InsertRoute = typeof routes.$inferInsert;

// ============================================================================
// ROUTE_STEPS - Individual steps in a route
// ============================================================================
export const routeSteps = mysqlTable("route_steps", {
  id: int("id").autoincrement().primaryKey(),
  routeId: int("route_id").notNull(),
  stepOrder: int("step_order").notNull(),
  actionType: mysqlEnum("action_type", [
    "WEIGH",           // Read weight from scale
    "WEIGH_STABLE",    // Wait for stable weight
    "DISPLAY",         // Show text on scale display
    "PRINT",           // Print label
    "SEND_TO_ONEBOX",  // Send result to CRM
    "WAIT",            // Wait N seconds
    "ZERO",            // Zero the scale
    "TARE",            // Set tare
    "CUSTOM"           // Custom command
  ]).notNull(),
  payloadJson: json("payload_json"), // Action-specific config
  timeoutMs: int("timeout_ms").default(5000),
  onErrorAction: mysqlEnum("on_error_action", ["STOP", "SKIP", "RETRY"]).default("STOP"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type RouteStep = typeof routeSteps.$inferSelect;
export type InsertRouteStep = typeof routeSteps.$inferInsert;

// ============================================================================
// WEIGHING_TASKS - Main task queue for weighing operations
// ============================================================================
export const weighingTasks = mysqlTable("weighing_tasks", {
  id: int("id").autoincrement().primaryKey(),
  taskId: varchar("task_id", { length: 64 }).notNull().unique(), // T-001, T-002...
  externalRef: varchar("external_ref", { length: 128 }), // OneBox order ID
  
  // Status tracking
  status: mysqlEnum("status", [
    "NEW",        // Just created
    "QUEUED",     // Ready to process
    "RUNNING",    // Currently being processed
    "DONE",       // Successfully completed
    "FAILED",     // Failed with error
    "STUCK",      // Running too long
    "CANCELLED"   // Manually cancelled
  ]).default("NEW").notNull(),
  
  // Assignment
  scaleId: int("scale_id"),
  printerId: int("printer_id"),
  routeId: int("route_id"),
  
  // Product info (from OneBox or manual)
  sku: varchar("sku", { length: 128 }),
  productName: varchar("product_name", { length: 256 }),
  batch: varchar("batch", { length: 64 }),
  
  // Weight parameters
  tare: decimal("tare", { precision: 10, scale: 3 }).default("0"),
  targetWeight: decimal("target_weight", { precision: 10, scale: 3 }),
  minWeight: decimal("min_weight", { precision: 10, scale: 3 }),
  maxWeight: decimal("max_weight", { precision: 10, scale: 3 }),
  unit: varchar("unit", { length: 8 }).default("kg"),
  
  // Results
  resultWeight: decimal("result_weight", { precision: 10, scale: 3 }),
  resultNet: decimal("result_net", { precision: 10, scale: 3 }),
  resultGross: decimal("result_gross", { precision: 10, scale: 3 }),
  isStable: boolean("is_stable"),
  rawMessage: text("raw_message"), // Raw SICS response
  
  // Error handling
  errorMessage: text("error_message"),
  retryCount: int("retry_count").default(0),
  maxRetries: int("max_retries").default(3),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  queuedAt: timestamp("queued_at"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  
  // OneBox sync
  oneboxSynced: boolean("onebox_synced").default(false),
  oneboxSyncedAt: timestamp("onebox_synced_at"),
  oneboxResponse: text("onebox_response"),
});
export type WeighingTask = typeof weighingTasks.$inferSelect;
export type InsertWeighingTask = typeof weighingTasks.$inferInsert;

// ============================================================================
// APP_SETTINGS - Key-value configuration store
// ============================================================================
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value"),
  valueType: mysqlEnum("value_type", ["string", "number", "boolean", "json"]).default("string"),
  description: text("description"),
  category: varchar("category", { length: 64 }).default("general"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

// Default settings keys:
// - queue.concurrency (number): Max parallel tasks
// - queue.pollingInterval (number): ms between queue checks
// - scale.readTimeoutMs (number): Timeout for scale read
// - scale.writeTimeoutMs (number): Timeout for scale write
// - scale.stabilizeTimeMs (number): Time to wait for stable weight
// - onebox.baseUrl (string): OneBox API URL
// - onebox.token (string): OneBox API token
// - onebox.timeout (number): API timeout in seconds
// - telegram.botToken (string): Telegram bot token
// - telegram.chatId (string): Telegram chat ID

// ============================================================================
// ONEBOX_SETTINGS - OneBox CRM integration (singleton)
// ============================================================================
export const oneboxSettings = mysqlTable("onebox_settings", {
  id: int("id").autoincrement().primaryKey(),
  baseUrl: varchar("base_url", { length: 512 }),
  apiToken: varchar("api_token", { length: 512 }),
  timeoutSec: int("timeout_sec").default(30),
  workflowId: varchar("workflow_id", { length: 64 }), // OneBox workflow for weighing tasks
  statusFieldId: varchar("status_field_id", { length: 64 }), // Custom field for weight status
  weightFieldId: varchar("weight_field_id", { length: 64 }), // Custom field for actual weight
  enabled: boolean("enabled").default(false).notNull(),
  lastSyncAt: timestamp("last_sync_at"),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type OneboxSetting = typeof oneboxSettings.$inferSelect;
export type InsertOneboxSetting = typeof oneboxSettings.$inferInsert;

// ============================================================================
// TELEGRAM_SETTINGS - Telegram notifications (singleton)
// ============================================================================
export const telegramSettings = mysqlTable("telegram_settings", {
  id: int("id").autoincrement().primaryKey(),
  botToken: varchar("bot_token", { length: 256 }),
  chatId: varchar("chat_id", { length: 64 }),
  enabled: boolean("enabled").default(false).notNull(),
  notifyOnError: boolean("notify_on_error").default(true),
  notifyOnStuck: boolean("notify_on_stuck").default(true),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type TelegramSetting = typeof telegramSettings.$inferSelect;
export type InsertTelegramSetting = typeof telegramSettings.$inferInsert;

// ============================================================================
// EVENTS_LOG - Detailed event logging
// ============================================================================
export const eventsLog = mysqlTable("events_log", {
  id: int("id").autoincrement().primaryKey(),
  ts: timestamp("ts").defaultNow().notNull(),
  level: mysqlEnum("level", ["DEBUG", "INFO", "WARN", "ERROR"]).default("INFO").notNull(),
  source: mysqlEnum("source", [
    "QUEUE",      // Queue worker
    "SCALE",      // Scale communication
    "PRINTER",    // Printer communication
    "ONEBOX",     // OneBox API
    "API",        // REST API
    "SYSTEM",     // System events
    "AUTH"        // Authentication
  ]).notNull(),
  entityType: varchar("entity_type", { length: 32 }), // task, scale, printer, route
  entityId: varchar("entity_id", { length: 64 }),
  message: text("message").notNull(),
  detailsJson: json("details_json"),
});
export type EventLog = typeof eventsLog.$inferSelect;
export type InsertEventLog = typeof eventsLog.$inferInsert;

// ============================================================================
// METRICS_SNAPSHOTS - System metrics over time
// ============================================================================
export const metricsSnapshots = mysqlTable("metrics_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  ts: timestamp("ts").defaultNow().notNull(),
  
  // Queue metrics
  queueDepth: int("queue_depth").default(0),
  tasksNew: int("tasks_new").default(0),
  tasksQueued: int("tasks_queued").default(0),
  tasksRunning: int("tasks_running").default(0),
  tasksDone: int("tasks_done").default(0),
  tasksFailed: int("tasks_failed").default(0),
  tasksStuck: int("tasks_stuck").default(0),
  
  // Performance metrics
  successRate: decimal("success_rate", { precision: 5, scale: 2 }), // 0-100%
  avgTaskDurationMs: int("avg_task_duration_ms"),
  tasksLastHour: int("tasks_last_hour").default(0),
  errorsLastHour: int("errors_last_hour").default(0),
  
  // Device metrics
  onlineScales: int("online_scales").default(0),
  totalScales: int("total_scales").default(0),
  onlinePrinters: int("online_printers").default(0),
  totalPrinters: int("total_printers").default(0),
  
  // OneBox sync
  lastOneboxSyncAt: timestamp("last_onebox_sync_at"),
  oneboxSyncStatus: mysqlEnum("onebox_sync_status", ["OK", "ERROR", "DISABLED"]).default("DISABLED"),
  
  // System resources (optional)
  cpuPercent: decimal("cpu_percent", { precision: 5, scale: 2 }),
  memoryPercent: decimal("memory_percent", { precision: 5, scale: 2 }),
  uptimeSeconds: bigint("uptime_seconds", { mode: "number" }),
});
export type MetricsSnapshot = typeof metricsSnapshots.$inferSelect;
export type InsertMetricsSnapshot = typeof metricsSnapshots.$inferInsert;

// ============================================================================
// CONNECTOR_STATUS - Worker process status (singleton)
// ============================================================================
export const connectorStatus = mysqlTable("connector_status", {
  id: int("id").autoincrement().primaryKey(),
  status: mysqlEnum("status", ["running", "stopped", "error", "unknown"]).default("unknown").notNull(),
  version: varchar("version", { length: 32 }),
  lastHeartbeat: timestamp("last_heartbeat"),
  uptime: varchar("uptime", { length: 64 }),
  currentTaskId: varchar("current_task_id", { length: 64 }),
  errorMessage: text("error_message"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type ConnectorStatus = typeof connectorStatus.$inferSelect;
export type InsertConnectorStatus = typeof connectorStatus.$inferInsert;

// ============================================================================
// LOGS - General system logs (existing, kept for compatibility)
// ============================================================================
export const logs = mysqlTable("logs", {
  id: int("id").autoincrement().primaryKey(),
  level: mysqlEnum("level", ["debug", "info", "warning", "error", "critical"]).default("info").notNull(),
  source: varchar("source", { length: 128 }).notNull(),
  message: text("message").notNull(),
  entityType: varchar("entity_type", { length: 64 }),
  entityId: int("entity_id"),
  metaJson: json("meta_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type Log = typeof logs.$inferSelect;
export type InsertLog = typeof logs.$inferInsert;

// ============================================================================
// QUEUE_TASKS - Legacy queue (kept for compatibility)
// ============================================================================
export const queueTasks = mysqlTable("queue_tasks", {
  id: int("id").autoincrement().primaryKey(),
  taskId: varchar("task_id", { length: 64 }).notNull().unique(),
  sku: varchar("sku", { length: 128 }),
  scaleId: int("scale_id"),
  printerId: int("printer_id"),
  status: mysqlEnum("status", ["pending", "running", "completed", "failed", "cancelled", "stuck"]).default("pending").notNull(),
  priority: int("priority").default(0).notNull(),
  retries: int("retries").default(0).notNull(),
  maxRetries: int("max_retries").default(3).notNull(),
  errorMessage: text("error_message"),
  inputData: json("input_data"),
  outputData: json("output_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
});
export type QueueTask = typeof queueTasks.$inferSelect;
export type InsertQueueTask = typeof queueTasks.$inferInsert;
