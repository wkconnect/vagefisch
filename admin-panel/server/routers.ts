import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from './_core/trpc';
import { systemRouter } from './_core/systemRouter';
import * as db from './db';
import net from 'net';
import sicsDriver from './drivers/sics';

// Admin procedure - only admin role
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

// Operator procedure - admin or operator roles
const operatorProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'operator') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Operator access required' });
  }
  return next({ ctx });
});

// Viewer procedure - allows all authenticated users
const viewerProcedure = protectedProcedure;

// ==================== MOCK SCALE ADAPTER ====================
const MOCK_SCALES: Record<string, { enabled: boolean; weight: number; unit: string }> = {
  '192.168.1.250:4001': { enabled: true, weight: 12.45, unit: 'kg' },
  '192.168.1.251:4001': { enabled: true, weight: 8.32, unit: 'kg' },
  '10.0.0.100:4001': { enabled: true, weight: 25.00, unit: 'kg' },
};

const DEV_MODE = process.env.NODE_ENV !== 'production' || process.env.MOCK_SCALES === 'true';

// Helper: Error code to human-readable message
function getErrorMessage(err: NodeJS.ErrnoException): string {
  const errorMessages: Record<string, string> = {
    'ECONNREFUSED': 'Connection refused: port is closed or service is not running',
    'ETIMEDOUT': 'Connection timed out: host is unreachable or firewall is blocking',
    'EHOSTUNREACH': 'Host unreachable: check network connectivity',
    'ENETUNREACH': 'Network unreachable: check network configuration',
    'ENOTFOUND': 'Host not found: DNS resolution failed',
    'ECONNRESET': 'Connection reset by peer: service may have crashed',
    'EPIPE': 'Broken pipe: connection was closed unexpectedly',
    'EADDRINUSE': 'Address already in use',
    'EADDRNOTAVAIL': 'Address not available',
  };
  
  const code = err.code || 'UNKNOWN';
  return errorMessages[code] || `${code}: ${err.message}`;
}

// Helper: Test TCP connection with detailed error reporting
async function testTcpConnection(ip: string, port: number, timeoutMs: number = 5000): Promise<{ 
  success: boolean; 
  latencyMs?: number; 
  error?: string;
  errorCode?: string;
  mockMode?: boolean;
  weight?: number;
  unit?: string;
}> {
  const key = `${ip}:${port}`;
  
  // Check if mock mode is enabled and this is a mock scale
  if (DEV_MODE && MOCK_SCALES[key]) {
    const mockScale = MOCK_SCALES[key];
    if (mockScale.enabled) {
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
      return { 
        success: true, 
        latencyMs: Math.floor(50 + Math.random() * 100),
        mockMode: true,
        weight: mockScale.weight + (Math.random() * 0.1 - 0.05),
        unit: mockScale.unit,
      };
    }
  }
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    
    socket.setTimeout(timeoutMs);
    
    socket.on('connect', () => {
      const latencyMs = Date.now() - startTime;
      socket.destroy();
      resolve({ success: true, latencyMs });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ 
        success: false, 
        error: `Connection timeout after ${timeoutMs}ms: host may be unreachable or firewall is blocking`,
        errorCode: 'ETIMEDOUT',
      });
    });
    
    socket.on('error', (err: NodeJS.ErrnoException) => {
      socket.destroy();
      resolve({ 
        success: false, 
        error: getErrorMessage(err),
        errorCode: err.code || 'UNKNOWN',
      });
    });
    
    socket.connect(port, ip);
  });
}

// Helper: Log action
async function logAction(level: 'info' | 'warning' | 'error', source: string, message: string, entityType?: string, entityId?: number, meta?: object) {
  await db.createLog({
    level,
    source,
    message,
    entityType,
    entityId,
    metaJson: meta || null,
  });
}

// Helper: Log event to events_log
async function logEvent(
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
  source: 'QUEUE' | 'SCALE' | 'PRINTER' | 'ONEBOX' | 'API' | 'SYSTEM' | 'AUTH',
  message: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  await db.createEventLog({
    level,
    source,
    message,
    entityType,
    entityId,
    detailsJson: details ? JSON.stringify(details) : null
  });
}

// Helper: Generate task ID
function generateTaskId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `T-${timestamp}-${random}`;
}

export const appRouter = router({
  system: systemRouter,
  
  // ==================== AUTH ====================
  auth: router({
    me: protectedProcedure.query(({ ctx }) => {
      return ctx.user;
    }),
    
    login: publicProcedure
      .input(z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        const { authenticateUser } = await import('./_core/auth');
        const user = await authenticateUser(input.username, input.password);
        if (!user) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid username or password' });
        }
        
        const { setSessionCookie } = await import('./_core/auth');
        setSessionCookie(ctx.res, user);
        
        await logAction('info', 'Auth', `User logged in: ${user.username}`, 'user', user.id, { ip: ctx.req.ip });
        
        return { success: true, user: { id: user.id, username: user.username, name: user.name, role: user.role } };
      }),
    
    logout: protectedProcedure.mutation(async ({ ctx }) => {
      const { clearSessionCookie } = await import('./_core/auth');
      clearSessionCookie(ctx.res);
      await logAction('info', 'Auth', `User logged out: ${ctx.user.username}`, 'user', ctx.user.id);
      return { success: true };
    }),
  }),
  
  // ==================== DASHBOARD ====================
  dashboard: router({
    getStatus: viewerProcedure.query(async () => {
      const [scales, printers, connectorStatus, queueStats, recentErrors, metrics] = await Promise.all([
        db.getAllScales(),
        db.getAllPrinters(),
        db.getConnectorStatus(),
        db.getQueueStats(),
        db.getRecentErrors(5),
        db.getLatestMetrics(),
      ]);
      
      const scalesOnline = scales.filter(s => s.status === 'online').length;
      const printersOnline = printers.filter(p => p.status === 'online').length;
      
      return {
        connector: connectorStatus || { status: 'unknown', lastSeen: null },
        onebox: { 
          status: connectorStatus?.oneboxConnected ? 'connected' : 'disconnected',
          lastSync: connectorStatus?.lastSync,
        },
        scales: { total: scales.length, online: scalesOnline },
        printers: { total: printers.length, online: printersOnline },
        queue: queueStats,
        recentErrors,
        metrics,
        mockMode: DEV_MODE,
      };
    }),
    
    getMetricsHistory: viewerProcedure
      .input(z.object({
        hours: z.number().min(1).max(168).default(24),
      }))
      .query(async ({ input }) => {
        return await db.getMetricsHistory(input.hours);
      }),
  }),
  
  // ==================== SCALES ====================
  scales: router({
    list: viewerProcedure.query(async () => {
      return await db.getAllScales();
    }),
    
    get: viewerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const scale = await db.getScaleById(input.id);
        if (!scale) throw new TRPCError({ code: 'NOT_FOUND', message: 'Scale not found' });
        return scale;
      }),
    
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(64),
        ip: z.string().min(1).max(45),
        port: z.number().min(1).max(65535).default(4001),
        protocol: z.enum(['SICS', 'IND', 'MT-SICS', 'CUSTOM']).default('SICS'),
        enabled: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createScale(input);
        await logAction('info', 'Scales', `Scale created: ${input.name}`, 'scale', id, { user: ctx.user.username });
        return { id, success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(64).optional(),
        ip: z.string().min(1).max(45).optional(),
        port: z.number().min(1).max(65535).optional(),
        protocol: z.enum(['SICS', 'IND', 'MT-SICS', 'CUSTOM']).optional(),
        enabled: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const scale = await db.getScaleById(input.id);
        if (!scale) throw new TRPCError({ code: 'NOT_FOUND', message: 'Scale not found' });
        
        await db.updateScale(input.id, input);
        await logAction('info', 'Scales', `Scale updated: ${scale.name}`, 'scale', input.id, { user: ctx.user.username, changes: input });
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const scale = await db.getScaleById(input.id);
        if (!scale) throw new TRPCError({ code: 'NOT_FOUND', message: 'Scale not found' });
        
        await db.deleteScale(input.id);
        await logAction('warning', 'Scales', `Scale deleted: ${scale.name}`, 'scale', input.id, { user: ctx.user.username });
        return { success: true };
      }),
    
    test: operatorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const scale = await db.getScaleById(input.id);
        if (!scale) throw new TRPCError({ code: 'NOT_FOUND', message: 'Scale not found' });
        
        const result = await testTcpConnection(scale.ip, scale.port);
        
        if (result.success) {
          await db.updateScaleStatus(input.id, 'online');
          const logMessage = result.mockMode 
            ? `Scale test successful (MOCK): ${scale.name} (${result.latencyMs}ms, weight: ${result.weight?.toFixed(2)}${result.unit})`
            : `Scale test successful: ${scale.name} (${result.latencyMs}ms)`;
          await logAction('info', 'Scales', logMessage, 'scale', input.id, { 
            user: ctx.user.username, 
            latencyMs: result.latencyMs,
            mockMode: result.mockMode,
            weight: result.weight,
          });
        } else {
          await db.updateScaleStatus(input.id, 'offline', result.error);
          await logAction('error', 'Scales', `Scale test failed: ${scale.name} - ${result.error}`, 'scale', input.id, { 
            user: ctx.user.username, 
            error: result.error,
            errorCode: result.errorCode,
          });
        }
        
        return { 
          success: result.success, 
          latencyMs: result.latencyMs, 
          error: result.error,
          errorCode: result.errorCode,
          mockMode: result.mockMode,
          weight: result.weight,
          unit: result.unit,
        };
      }),
    
    // Read weight from scale using SICS driver
    readWeight: operatorProcedure
      .input(z.object({ 
        id: z.number(),
        waitForStable: z.boolean().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        const scale = await db.getScaleById(input.id);
        if (!scale) throw new TRPCError({ code: 'NOT_FOUND', message: 'Scale not found' });
        
        const config = {
          ip: scale.ip,
          port: scale.port,
          protocol: scale.protocol as 'SICS' | 'IND' | 'MT-SICS' | 'CUSTOM',
          readCommand: scale.readCommand || 'SI',
          stableCommand: scale.stableCommand || 'S',
          zeroCommand: scale.zeroCommand || 'Z',
          displayCommand: scale.displayCommand || 'D',
          timeoutMs: 5000
        };
        
        const result = input.waitForStable 
          ? await sicsDriver.waitForStableWeight(config, 30000)
          : await sicsDriver.readWeightImmediate(config);
        
        if (result.success) {
          await db.updateScaleStatus(input.id, 'online');
          await db.updateScaleLastWeight(input.id, result.weight!, result.unit!);
          await logEvent('INFO', 'SCALE', `Weight read: ${result.weight} ${result.unit}`, 'scale', String(input.id), {
            user: ctx.user.username,
            isStable: result.isStable
          });
        } else {
          await logEvent('ERROR', 'SCALE', `Weight read failed: ${result.error}`, 'scale', String(input.id));
        }
        
        return result;
      }),
    
    // Zero the scale
    zero: operatorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const scale = await db.getScaleById(input.id);
        if (!scale) throw new TRPCError({ code: 'NOT_FOUND', message: 'Scale not found' });
        
        const config = {
          ip: scale.ip,
          port: scale.port,
          protocol: scale.protocol as 'SICS' | 'IND' | 'MT-SICS' | 'CUSTOM',
          zeroCommand: scale.zeroCommand || 'Z',
          timeoutMs: 5000
        };
        
        const result = await sicsDriver.zeroScale(config);
        
        await logEvent(result.success ? 'INFO' : 'ERROR', 'SCALE', 
          result.success ? 'Scale zeroed' : `Zero failed: ${result.error}`,
          'scale', String(input.id), { user: ctx.user.username });
        
        return result;
      }),
    
    // Display text on scale
    display: operatorProcedure
      .input(z.object({ 
        id: z.number(),
        text: z.string().max(20),
      }))
      .mutation(async ({ input, ctx }) => {
        const scale = await db.getScaleById(input.id);
        if (!scale) throw new TRPCError({ code: 'NOT_FOUND', message: 'Scale not found' });
        
        const config = {
          ip: scale.ip,
          port: scale.port,
          protocol: scale.protocol as 'SICS' | 'IND' | 'MT-SICS' | 'CUSTOM',
          displayCommand: scale.displayCommand || 'D',
          timeoutMs: 5000
        };
        
        const result = await sicsDriver.displayText(config, input.text);
        
        return result;
      }),
  }),
  
  // ==================== PRINTERS ====================
  printers: router({
    list: viewerProcedure.query(async () => {
      return await db.getAllPrinters();
    }),
    
    get: viewerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const printer = await db.getPrinterById(input.id);
        if (!printer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Printer not found' });
        return printer;
      }),
    
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(64),
        ip: z.string().min(1).max(45),
        port: z.number().min(1).max(65535).default(9100),
        protocol: z.enum(['ZPL', 'RAW', 'IPP', 'CUSTOM']).default('ZPL'),
        enabled: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        const id = await db.createPrinter(input);
        await logAction('info', 'Printers', `Printer created: ${input.name}`, 'printer', id, { user: ctx.user.username });
        return { id, success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(64).optional(),
        ip: z.string().min(1).max(45).optional(),
        port: z.number().min(1).max(65535).optional(),
        protocol: z.enum(['ZPL', 'RAW', 'IPP', 'CUSTOM']).optional(),
        enabled: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const printer = await db.getPrinterById(input.id);
        if (!printer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Printer not found' });
        
        await db.updatePrinter(input.id, input);
        await logAction('info', 'Printers', `Printer updated: ${printer.name}`, 'printer', input.id, { user: ctx.user.username, changes: input });
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const printer = await db.getPrinterById(input.id);
        if (!printer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Printer not found' });
        
        await db.deletePrinter(input.id);
        await logAction('warning', 'Printers', `Printer deleted: ${printer.name}`, 'printer', input.id, { user: ctx.user.username });
        return { success: true };
      }),
    
    test: operatorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const printer = await db.getPrinterById(input.id);
        if (!printer) throw new TRPCError({ code: 'NOT_FOUND', message: 'Printer not found' });
        
        const result = await testTcpConnection(printer.ip, printer.port);
        
        if (result.success) {
          await db.updatePrinterStatus(input.id, 'online');
          await logAction('info', 'Printers', `Printer test successful: ${printer.name} (${result.latencyMs}ms)`, 'printer', input.id, { user: ctx.user.username, latencyMs: result.latencyMs });
        } else {
          await db.updatePrinterStatus(input.id, 'offline', result.error);
          await logAction('error', 'Printers', `Printer test failed: ${printer.name} - ${result.error}`, 'printer', input.id, { 
            user: ctx.user.username, 
            error: result.error,
            errorCode: result.errorCode,
          });
        }
        
        return { 
          success: result.success, 
          latencyMs: result.latencyMs, 
          error: result.error,
          errorCode: result.errorCode,
        };
      }),
  }),
  
  // ==================== ROUTES ====================
  routes: router({
    list: viewerProcedure.query(async () => {
      return await db.getAllRoutes();
    }),
    
    get: viewerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const route = await db.getRouteById(input.id);
        if (!route) throw new TRPCError({ code: 'NOT_FOUND', message: 'Route not found' });
        return route;
      }),
    
    getWithSteps: viewerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const route = await db.getRouteById(input.id);
        if (!route) throw new TRPCError({ code: 'NOT_FOUND', message: 'Route not found' });
        const steps = await db.getRouteSteps(input.id);
        return { ...route, steps };
      }),
    
    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(128),
        description: z.string().optional(),
        isActive: z.boolean().default(true),
        isDefault: z.boolean().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        // If setting as default, clear other defaults
        if (input.isDefault) {
          await db.clearDefaultRoutes();
        }
        const id = await db.createRoute(input);
        await logAction('info', 'Routes', `Route created: ${input.name}`, 'route', id, { user: ctx.user.username });
        return { id, success: true };
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(128).optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const route = await db.getRouteById(input.id);
        if (!route) throw new TRPCError({ code: 'NOT_FOUND', message: 'Route not found' });
        
        // If setting as default, clear other defaults
        if (input.isDefault) {
          await db.clearDefaultRoutes();
        }
        
        await db.updateRoute(input.id, input);
        await logAction('info', 'Routes', `Route updated: ${route.name}`, 'route', input.id, { user: ctx.user.username, changes: input });
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const route = await db.getRouteById(input.id);
        if (!route) throw new TRPCError({ code: 'NOT_FOUND', message: 'Route not found' });
        
        await db.deleteRoute(input.id);
        await logAction('warning', 'Routes', `Route deleted: ${route.name}`, 'route', input.id, { user: ctx.user.username });
        return { success: true };
      }),
    
    // Route steps management
    // Route steps management - LIST
    listSteps: viewerProcedure
      .input(z.object({ routeId: z.number() }))
      .query(async ({ input }) => {
        const route = await db.getRouteById(input.routeId);
        
        const steps = await db.getRouteSteps(input.routeId);
        return { steps, routeName: route.name };
      }),
    
    // Route steps management - REORDER
    reorderSteps: adminProcedure
      .input(z.object({
        routeId: z.number(),
        stepIds: z.array(z.number()),
      }))
      .mutation(async ({ input, ctx }) => {
        const route = await db.getRouteById(input.routeId);
        
        for (let i = 0; i < input.stepIds.length; i++) {
          await db.updateRouteStep(input.stepIds[i], { stepOrder: i + 1 });
        }
        
        await logAction("info", "Routes", "Steps reordered for route: " + route.name, "route", input.routeId, { user: ctx.user.username });
        return { success: true };
      }),

    addStep: adminProcedure
      .input(z.object({
        routeId: z.number(),
        stepOrder: z.number().min(1),
        actionType: z.enum(['WEIGH', 'WEIGH_STABLE', 'DISPLAY', 'PRINT', 'SEND_TO_ONEBOX', 'WAIT', 'ZERO', 'TARE', 'CUSTOM']),
        payloadJson: z.record(z.unknown()).optional(),
        timeoutMs: z.number().min(100).max(300000).default(5000),
        onErrorAction: z.enum(['STOP', 'SKIP', 'RETRY']).default('STOP'),
      }))
      .mutation(async ({ input, ctx }) => {
        const route = await db.getRouteById(input.routeId);
        if (!route) throw new TRPCError({ code: 'NOT_FOUND', message: 'Route not found' });
        
        const id = await db.createRouteStep(input);
        await logAction('info', 'Routes', `Step added to route: ${route.name}`, 'route', input.routeId, { user: ctx.user.username, step: input });
        return { id, success: true };
      }),
    
    updateStep: adminProcedure
      .input(z.object({
        id: z.number(),
        stepOrder: z.number().min(1).optional(),
        actionType: z.enum(['WEIGH', 'WEIGH_STABLE', 'DISPLAY', 'PRINT', 'SEND_TO_ONEBOX', 'WAIT', 'ZERO', 'TARE', 'CUSTOM']).optional(),
        payloadJson: z.record(z.unknown()).optional(),
        timeoutMs: z.number().min(100).max(300000).optional(),
        onErrorAction: z.enum(['STOP', 'SKIP', 'RETRY']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updateRouteStep(input.id, input);
        await logAction('info', 'Routes', `Route step updated`, 'routeStep', input.id, { user: ctx.user.username, changes: input });
        return { success: true };
      }),
    
    deleteStep: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteRouteStep(input.id);
        await logAction('warning', 'Routes', `Route step deleted`, 'routeStep', input.id, { user: ctx.user.username });
        return { success: true };
      }),
  }),
  
  // ==================== WEIGHING TASKS ====================
  weighingTasks: router({
    list: viewerProcedure
      .input(z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        status: z.enum(['NEW', 'QUEUED', 'RUNNING', 'DONE', 'FAILED', 'STUCK', 'CANCELLED']).optional(),
        scaleId: z.number().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getWeighingTasks(input);
      }),
    
    get: viewerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const task = await db.getWeighingTaskById(input.id);
        if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
        return task;
      }),
    
    getByTaskId: viewerProcedure
      .input(z.object({ taskId: z.string() }))
      .query(async ({ input }) => {
        const task = await db.getWeighingTaskByTaskId(input.taskId);
        if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
        return task;
      }),
    
    create: operatorProcedure
      .input(z.object({
        scaleId: z.number().optional(),
        printerId: z.number().optional(),
        routeId: z.number().optional(),
        externalRef: z.string().optional(),
        sku: z.string().optional(),
        productName: z.string().optional(),
        batch: z.string().optional(),
        targetWeight: z.number().optional(),
        minWeight: z.number().optional(),
        maxWeight: z.number().optional(),
        tare: z.number().optional(),
        unit: z.string().default('kg'),
      }))
      .mutation(async ({ input, ctx }) => {
        const taskId = generateTaskId();
        
        const id = await db.createWeighingTask({
          taskId,
          status: 'QUEUED',
          queuedAt: new Date(),
          ...input
        });
        
        await logEvent('INFO', 'QUEUE', `Task created: ${taskId}`, 'task', taskId, {
          user: ctx.user.username,
          ...input
        });
        
        return { id, taskId, success: true };
      }),
    
    retry: operatorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const task = await db.getWeighingTaskById(input.id);
        if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
        
        if (!['FAILED', 'STUCK', 'CANCELLED'].includes(task.status)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Can only retry failed/stuck/cancelled tasks' });
        }
        
        await db.updateWeighingTask(input.id, {
          status: 'QUEUED',
          queuedAt: new Date(),
          startedAt: null,
          finishedAt: null,
          errorMessage: null
        });
        
        await logEvent('INFO', 'QUEUE', `Task queued for retry: ${task.taskId}`, 'task', task.taskId, {
          user: ctx.user.username
        });
        
        return { success: true };
      }),
    
    cancel: operatorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const task = await db.getWeighingTaskById(input.id);
        if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
        
        if (['DONE', 'CANCELLED'].includes(task.status)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Task already completed or cancelled' });
        }
        
        await db.updateWeighingTask(input.id, {
          status: 'CANCELLED',
          finishedAt: new Date()
        });
        
        await logEvent('INFO', 'QUEUE', `Task cancelled: ${task.taskId}`, 'task', task.taskId, {
          user: ctx.user.username
        });
        
        return { success: true };
      }),
    
    getStats: viewerProcedure.query(async () => {
      return await db.getWeighingTaskStats();
    }),
  }),
  
  // ==================== SETTINGS ====================
  settings: router({
    getAll: viewerProcedure.query(async () => {
      return await db.getAllSettings();
    }),
    
    get: viewerProcedure
      .input(z.object({ key: z.string() }))
      .query(async ({ input }) => {
        return await db.getSetting(input.key);
      }),
    
    set: adminProcedure
      .input(z.object({
        key: z.string().min(1).max(64),
        value: z.string(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.setSetting(input.key, input.value, input.description);
        await logAction('info', 'Settings', `Setting updated: ${input.key}`, 'setting', undefined, { user: ctx.user.username });
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ key: z.string() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteSetting(input.key);
        await logAction('warning', 'Settings', `Setting deleted: ${input.key}`, 'setting', undefined, { user: ctx.user.username });
        return { success: true };
      }),
    
    getOnebox: viewerProcedure.query(async () => {
      return await db.getOneboxSettings();
    }),
    
    saveOnebox: adminProcedure
      .input(z.object({
        baseUrl: z.string().url().optional(),
        apiToken: z.string().optional(),
        timeout: z.number().min(1).max(120).default(30),
        workflowId: z.string().optional(),
        enabled: z.boolean().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.saveOneboxSettings(input);
        await logAction('info', 'Settings', 'OneBox settings updated', 'onebox', undefined, { user: ctx.user.username });
        return { success: true };
      }),
    
    getTelegram: viewerProcedure.query(async () => {
      return await db.getTelegramSettings();
    }),
    
    saveTelegram: adminProcedure
      .input(z.object({
        botToken: z.string().optional(),
        chatId: z.string().optional(),
        enabled: z.boolean().default(false),
        notifyOnError: z.boolean().default(true),
        notifyOnStuck: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.saveTelegramSettings(input);
        await logAction('info', 'Settings', 'Telegram settings updated', 'telegram', undefined, { user: ctx.user.username });
        return { success: true };
      }),
  }),
  
  // ==================== LOGS ====================
  logs: router({
    list: viewerProcedure
      .input(z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        level: z.enum(['info', 'warning', 'error']).optional(),
        source: z.string().optional(),
        search: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getLogs(input);
      }),
    
    getRecent: viewerProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(10) }))
      .query(async ({ input }) => {
        return await db.getRecentErrors(input.limit);
      }),
  }),
  
  // ==================== EVENTS ====================
  events: router({
    list: viewerProcedure
      .input(z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']).optional(),
        source: z.enum(['QUEUE', 'SCALE', 'PRINTER', 'ONEBOX', 'API', 'SYSTEM', 'AUTH']).optional(),
        entityType: z.string().optional(),
        entityId: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return await db.getEvents(input);
      }),
    
    getRecent: viewerProcedure
      .input(z.object({ 
        limit: z.number().min(1).max(100).default(20),
        source: z.enum(['QUEUE', 'SCALE', 'PRINTER', 'ONEBOX', 'API', 'SYSTEM', 'AUTH']).optional(),
      }))
      .query(async ({ input }) => {
        return await db.getRecentEvents(input.limit, input.source);
      }),
  }),
  
  // ==================== QUEUE (legacy) ====================
  queue: router({
    list: viewerProcedure
      .input(z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        status: z.enum(['pending', 'active', 'completed', 'failed', 'cancelled', 'stuck']).optional(),
      }))
      .query(async ({ input }) => {
        return await db.getAllQueueTasks(input.status);
      }),
    
    get: viewerProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const task = await db.getQueueTaskById(input.id);
        if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
        return task;
      }),
    
    retry: operatorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const task = await db.getQueueTaskById(input.id);
        if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
        
        await db.retryQueueTask(input.id);
        await logAction('info', 'Queue', `Task retried: ${task.taskId}`, 'queue', input.id, { user: ctx.user.username });
        return { success: true };
      }),
    
    cancel: operatorProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const task = await db.getQueueTaskById(input.id);
        if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' });
        
        await db.cancelQueueTask(input.id);
        await logAction('warning', 'Queue', `Task cancelled: ${task.taskId}`, 'queue', input.id, { user: ctx.user.username });
        return { success: true };
      }),
    
    getStats: viewerProcedure.query(async () => {
      return await db.getQueueStats();
    }),
  }),
  
  // ==================== MONITORING ====================
  monitoring: router({
    getHealth: viewerProcedure.query(async () => {
      const [connector, scales, printers, metrics] = await Promise.all([
        db.getConnectorStatus(),
        db.getAllScales(),
        db.getAllPrinters(),
        db.getLatestMetrics(),
      ]);
      
      const scalesOnline = scales.filter(s => s.status === 'online').length;
      const printersOnline = printers.filter(p => p.status === 'online').length;
      
      // Determine overall health
      let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      const issues: string[] = [];
      
      if (!connector || connector.status !== 'running') {
        health = 'unhealthy';
        issues.push('Worker is not running');
      }
      
      if (scales.length > 0 && scalesOnline === 0) {
        health = health === 'healthy' ? 'degraded' : health;
        issues.push('No scales online');
      }
      
      if (metrics?.tasksStuck && metrics.tasksStuck > 0) {
        health = health === 'healthy' ? 'degraded' : health;
        issues.push(`${metrics.tasksStuck} stuck tasks`);
      }
      
      return {
        health,
        issues,
        connector: connector || { status: 'unknown' },
        scales: { total: scales.length, online: scalesOnline },
        printers: { total: printers.length, online: printersOnline },
        metrics,
      };
    }),
    
    getMetrics: viewerProcedure.query(async () => {
      return await db.getLatestMetrics();
    }),
    
    getMetricsHistory: viewerProcedure
      .input(z.object({
        hours: z.number().min(1).max(168).default(24),
      }))
      .query(async ({ input }) => {
        return await db.getMetricsHistory(input.hours);
      }),
    
    getConnectorStatus: viewerProcedure.query(async () => {
      return await db.getConnectorStatus();
    }),
  }),
});

export type AppRouter = typeof appRouter;
