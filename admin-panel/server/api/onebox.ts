/**
 * OneBox Integration REST API Routes
 * 
 * Base URL: http://192.168.1.74/api
 * Auth: Bearer Token in Authorization header
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db.js';
import { scales, weighingTasks, eventsLog, appSettings } from '../../drizzle/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import * as sicsDriver from '../drivers/sics.js';

const router = Router();

// In-memory session storage (for active weighing sessions)
interface WeighingSession {
  sessionId: string;
  orderId: string;
  lineId: string;
  productNameDe: string;
  sku: string;
  orderedQty: number;
  qtyUnit: string;
  scaleId: string;
  scaleDbId: number;
  operatorId: string;
  meta?: Record<string, unknown>;
  status: 'STARTED' | 'RUNNING' | 'CONFIRMED' | 'CANCELLED';
  startedAt: Date;
  lastWeight?: number;
  lastUnit?: string;
  lastStable?: boolean;
  lastRaw?: string;
  lastWeightAt?: Date;
  finalWeight?: number;
  confirmedAt?: Date;
}

const activeSessions = new Map<string, WeighingSession>();

// Generate unique session ID
function generateSessionId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  return `ws_${dateStr}_${seq}`;
}

// Log event helper
async function logEvent(
  level: 'INFO' | 'WARNING' | 'ERROR',
  source: string,
  message: string,
  entityType?: string,
  entityId?: string,
  metadata?: Record<string, unknown>
) {
  try {
    await db.insert(eventsLog).values({
      level,
      source,
      message,
      entityType,
      entityId,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date()
    });
  } catch (e) {
    console.error('[API] Failed to log event:', e);
  }
}

// Bearer Token Auth Middleware
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Missing or invalid Authorization header. Use: Bearer <token>'
    });
  }
  
  const token = authHeader.substring(7);
  
  // Get API token from appSettings
  const [apiTokenSetting] = await db.select()
    .from(appSettings)
    .where(eq(appSettings.key, 'onebox_api_token'));
  
  const validToken = apiTokenSetting?.value || 'vagefisch-api-token-2026';
  
  if (token !== validToken) {
    await logEvent('WARNING', 'API', 'Invalid API token attempt', undefined, undefined, {
      ip: req.ip,
      path: req.path
    });
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid API token'
    });
  }
  
  next();
}

// Apply auth to all routes
router.use(authMiddleware);

// ============================================
// WEIGHING SESSION ENDPOINTS
// ============================================

/**
 * POST /api/weighing/start
 * Start a new weighing session
 */
router.post('/weighing/start', async (req: Request, res: Response) => {
  try {
    const {
      order_id,
      line_id,
      product_name_de,
      sku,
      ordered_qty,
      qty_unit = 'pcs',
      scale_id,
      operator_id,
      meta
    } = req.body;
    
    // Validate required fields
    if (!order_id || !scale_id) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Missing required fields: order_id, scale_id'
      });
    }
    
    // Find scale by code/name
    const [scale] = await db.select()
      .from(scales)
      .where(eq(scales.name, scale_id));
    
    if (!scale) {
      return res.status(404).json({
        error: 'SCALE_NOT_FOUND',
        message: `Scale with id "${scale_id}" not found`
      });
    }
    
    // Check for existing active session on this scale
    for (const [existingSessionId, existingSession] of activeSessions.entries()) {
      if (existingSession.scaleDbId === scale.id && 
          (existingSession.status === "STARTED" || existingSession.status === "RUNNING")) {
        return res.status(409).json({
          error: "SCALE_BUSY",
          message: `Scale "" is already in use by session ""`,
          existing_session_id: existingSessionId
        });
      }
    }

    if (scale.status === 'offline') {
      return res.status(503).json({
        error: 'SCALE_OFFLINE',
        message: `Scale "${scale_id}" is offline`
      });
    }
    
    // Generate session ID
    const sessionId = generateSessionId();
    
    // Display text on scale
    const displayText = `${product_name_de || sku || 'Product'} | ${sku || ''} | ${ordered_qty || ''} ${qty_unit || ''}`.trim();
    let displaySent = false;
    
    try {
      const scaleConfig = {
        ip: scale.ip,
        port: scale.port,
        protocol: scale.protocol as 'SICS' | 'IND' | 'MT-SICS' | 'CUSTOM',
        timeout: 5000
      };
      
      const displayResult = await sicsDriver.displayText(scaleConfig, displayText.slice(0, 20));
      displaySent = displayResult.success;
    } catch (e) {
      console.error('[API] Failed to display text on scale:', e);
    }
    
    // Create session
    const session: WeighingSession = {
      sessionId,
      orderId: order_id,
      lineId: line_id || '',
      productNameDe: product_name_de || '',
      sku: sku || '',
      orderedQty: ordered_qty || 0,
      qtyUnit: qty_unit || 'pcs',
      scaleId: scale_id,
      scaleDbId: scale.id,
      operatorId: operator_id || '',
      meta,
      status: 'STARTED',
      startedAt: new Date()
    };
    
    activeSessions.set(sessionId, session);
    
    // Log event
    await logEvent('INFO', 'API', `Weighing session started`, 'session', sessionId, {
      orderId: order_id,
      lineId: line_id,
      scaleId: scale_id,
      sku
    });
    
    // Start background weight polling for this session
    startWeightPolling(sessionId, scale);
    
    res.json({
      session_id: sessionId,
      status: 'STARTED',
      scale_id: scale_id,
      display_text_sent: displaySent
    });
    
  } catch (error) {
    console.error('[API] Error starting weighing session:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/weighing/:session_id/live
 * Get current live weight for session
 */
router.get('/weighing/:session_id/live', async (req: Request, res: Response) => {
  try {
    const { session_id } = req.params;
    
    const session = activeSessions.get(session_id);
    
    if (!session) {
      return res.status(404).json({
        error: 'SESSION_NOT_FOUND',
        message: `Session "${session_id}" not found or expired`
      });
    }
    
    if (session.status === 'CONFIRMED' || session.status === 'CANCELLED') {
      return res.status(410).json({
        error: 'SESSION_CLOSED',
        message: `Session "${session_id}" is already ${session.status.toLowerCase()}`
      });
    }
    
    res.json({
      session_id: session.sessionId,
      status: session.status,
      weight: session.lastWeight ?? null,
      unit: session.lastUnit || 'kg',
      stable: session.lastStable ?? false,
      raw: session.lastRaw || '',
      ts: session.lastWeightAt?.toISOString() || new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API] Error getting live weight:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/weighing/:session_id/confirm
 * Confirm and finalize the weighing
 */
router.post('/weighing/:session_id/confirm', async (req: Request, res: Response) => {
  try {
    const { session_id } = req.params;
    const { action = 'CONFIRM', tare_after = false } = req.body;
    
    const session = activeSessions.get(session_id);
    
    if (!session) {
      return res.status(404).json({
        error: 'SESSION_NOT_FOUND',
        message: `Session "${session_id}" not found or expired`
      });
    }
    
    if (session.status === 'CONFIRMED') {
      return res.status(409).json({
        error: 'ALREADY_CONFIRMED',
        message: `Session "${session_id}" is already confirmed`,
        final_weight: session.finalWeight,
        confirmed_at: session.confirmedAt?.toISOString()
      });
    }
    
    if (session.status === 'CANCELLED') {
      return res.status(410).json({
        error: 'SESSION_CANCELLED',
        message: `Session "${session_id}" was cancelled`
      });
    }
    
    // Get final weight (use last known weight)
    const finalWeight = session.lastWeight ?? 0;
    const confirmedAt = new Date();
    
    // Update session
    session.status = 'CONFIRMED';
    session.finalWeight = finalWeight;
    session.confirmedAt = confirmedAt;
    
    // Log event
    await logEvent('INFO', 'API', `Weighing confirmed`, 'session', session_id, {
      orderId: session.orderId,
      lineId: session.lineId,
      finalWeight,
      unit: session.lastUnit
    });
    
    // Optionally tare after confirm
    if (tare_after) {
      try {
        const [scale] = await db.select().from(scales).where(eq(scales.id, session.scaleDbId));
        if (scale) {
          const scaleConfig = {
            ip: scale.ip,
            port: scale.port,
            protocol: scale.protocol as 'SICS' | 'IND' | 'MT-SICS' | 'CUSTOM',
            timeout: 5000
          };
          await sicsDriver.tareScale(scaleConfig, 0);
        }
      } catch (e) {
        console.error('[API] Failed to tare after confirm:', e);
      }
    }
    
    // Stop polling (session will be cleaned up)
    stopWeightPolling(session_id);
    
    // Keep session for a while for reference, then clean up
    setTimeout(() => {
      activeSessions.delete(session_id);
    }, 60000); // Keep for 1 minute after confirm
    
    res.json({
      session_id: session.sessionId,
      status: 'CONFIRMED',
      final_weight: finalWeight,
      unit: session.lastUnit || 'kg',
      confirmed_at: confirmedAt.toISOString()
    });
    
  } catch (error) {
    console.error('[API] Error confirming weighing:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/weighing/:session_id/cancel
 * Cancel a weighing session
 */
router.post('/weighing/:session_id/cancel', async (req: Request, res: Response) => {
  try {
    const { session_id } = req.params;
    
    const session = activeSessions.get(session_id);
    
    if (!session) {
      return res.status(404).json({
        error: 'SESSION_NOT_FOUND',
        message: `Session "${session_id}" not found or expired`
      });
    }
    
    if (session.status === 'CONFIRMED') {
      return res.status(409).json({
        error: 'ALREADY_CONFIRMED',
        message: `Session "${session_id}" is already confirmed and cannot be cancelled`
      });
    }
    
    // Update session
    session.status = 'CANCELLED';
    
    // Log event
    await logEvent('INFO', 'API', `Weighing cancelled`, 'session', session_id, {
      orderId: session.orderId,
      lineId: session.lineId
    });
    
    // Stop polling
    stopWeightPolling(session_id);
    
    // Clean up session
    setTimeout(() => {
      activeSessions.delete(session_id);
    }, 10000);
    
    res.json({
      session_id: session.sessionId,
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API] Error cancelling weighing:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// SCALE CONTROL ENDPOINTS
// ============================================

/**
 * POST /api/scales/:scale_id/tare
 * Tare the scale
 */
router.post('/scales/:scale_id/tare', async (req: Request, res: Response) => {
  try {
    const { scale_id } = req.params;
    const { value = 0 } = req.body;
    
    const [scale] = await db.select().from(scales).where(eq(scales.name, scale_id));
    
    if (!scale) {
      return res.status(404).json({
        error: 'SCALE_NOT_FOUND',
        message: `Scale "${scale_id}" not found`
      });
    }
    
    const scaleConfig = {
      ip: scale.ip,
      port: scale.port,
      protocol: scale.protocol as 'SICS' | 'IND' | 'MT-SICS' | 'CUSTOM',
      timeout: 5000
    };
    
    const result = await sicsDriver.tareScale(scaleConfig, value);
    
    if (!result.success) {
      return res.status(503).json({
        error: 'SCALE_ERROR',
        message: result.error || 'Failed to tare scale'
      });
    }
    
    await logEvent('INFO', 'API', `Scale tared`, 'scale', scale_id, { value });
    
    res.json({
      scale_id,
      action: 'TARE',
      success: true,
      value,
      ts: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API] Error taring scale:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/scales/:scale_id/zero
 * Zero the scale
 */
router.post('/scales/:scale_id/zero', async (req: Request, res: Response) => {
  try {
    const { scale_id } = req.params;
    
    const [scale] = await db.select().from(scales).where(eq(scales.name, scale_id));
    
    if (!scale) {
      return res.status(404).json({
        error: 'SCALE_NOT_FOUND',
        message: `Scale "${scale_id}" not found`
      });
    }
    
    const scaleConfig = {
      ip: scale.ip,
      port: scale.port,
      protocol: scale.protocol as 'SICS' | 'IND' | 'MT-SICS' | 'CUSTOM',
      timeout: 5000
    };
    
    const result = await sicsDriver.zeroScale(scaleConfig);
    
    if (!result.success) {
      return res.status(503).json({
        error: 'SCALE_ERROR',
        message: result.error || 'Failed to zero scale'
      });
    }
    
    await logEvent('INFO', 'API', `Scale zeroed`, 'scale', scale_id);
    
    res.json({
      scale_id,
      action: 'ZERO',
      success: true,
      ts: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API] Error zeroing scale:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/scales/:scale_id/display
 * Display text on scale
 */
router.post('/scales/:scale_id/display', async (req: Request, res: Response) => {
  try {
    const { scale_id } = req.params;
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Missing required field: text'
      });
    }
    
    const [scale] = await db.select().from(scales).where(eq(scales.name, scale_id));
    
    if (!scale) {
      return res.status(404).json({
        error: 'SCALE_NOT_FOUND',
        message: `Scale "${scale_id}" not found`
      });
    }
    
    const scaleConfig = {
      ip: scale.ip,
      port: scale.port,
      protocol: scale.protocol as 'SICS' | 'IND' | 'MT-SICS' | 'CUSTOM',
      timeout: 5000
    };
    
    const result = await sicsDriver.displayText(scaleConfig, text.slice(0, 20));
    
    if (!result.success) {
      return res.status(503).json({
        error: 'SCALE_ERROR',
        message: result.error || 'Failed to display text'
      });
    }
    
    res.json({
      scale_id,
      action: 'DISPLAY',
      success: true,
      text: text.slice(0, 20),
      ts: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[API] Error displaying text:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/scales/:scale_id/status
 * Get scale status
 */
router.get('/scales/:scale_id/status', async (req: Request, res: Response) => {
  try {
    const { scale_id } = req.params;
    
    const [scale] = await db.select().from(scales).where(eq(scales.name, scale_id));
    
    if (!scale) {
      return res.status(404).json({
        error: 'SCALE_NOT_FOUND',
        message: `Scale "${scale_id}" not found`
      });
    }
    
    res.json({
      scale_id: scale.name,
      online: scale.status === 'online',
      last_seen: scale.lastSeenAt?.toISOString() || null,
      last_error: scale.lastError || null,
      last_weight: scale.lastWeight || null,
      last_unit: scale.lastUnit || 'kg'
    });
    
  } catch (error) {
    console.error('[API] Error getting scale status:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// SCALES CRUD ENDPOINTS
// ============================================

/**
 * GET /api/scales
 * List all scales
 */
router.get('/scales', async (req: Request, res: Response) => {
  try {
    const allScales = await db.select().from(scales).orderBy(scales.name);
    
    res.json({
      scales: allScales.map(s => ({
        id: s.id,
        name: s.name,
        type: s.protocol,
        ip: s.ip,
        port: s.port,
        online: s.status === 'online',
        last_seen: s.lastSeenAt?.toISOString() || null
      }))
    });
    
  } catch (error) {
    console.error('[API] Error listing scales:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/scales
 * Create a new scale
 */
router.post('/scales', async (req: Request, res: Response) => {
  try {
    const { name, type = 'SICS', ip, port = 4305 } = req.body;
    
    if (!name || !ip) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Missing required fields: name, ip'
      });
    }
    
    // Check if name already exists
    const [existing] = await db.select().from(scales).where(eq(scales.name, name));
    if (existing) {
      return res.status(409).json({
        error: 'ALREADY_EXISTS',
        message: `Scale with name "${name}" already exists`
      });
    }
    
    const [newScale] = await db.insert(scales).values({
      name,
      protocol: type,
      ip,
      port,
      status: 'offline',
      createdAt: new Date()
    }).returning();
    
    await logEvent('INFO', 'API', `Scale created`, 'scale', name, { ip, port, type });
    
    res.status(201).json({
      id: newScale.id,
      name: newScale.name,
      type: newScale.protocol,
      ip: newScale.ip,
      port: newScale.port,
      online: false
    });
    
  } catch (error) {
    console.error('[API] Error creating scale:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PATCH /api/scales/:id
 * Update a scale
 */
router.patch('/scales/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, ip, port } = req.body;
    
    const [scale] = await db.select().from(scales).where(eq(scales.id, parseInt(id)));
    
    if (!scale) {
      return res.status(404).json({
        error: 'SCALE_NOT_FOUND',
        message: `Scale with id "${id}" not found`
      });
    }
    
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.protocol = type;
    if (ip !== undefined) updates.ip = ip;
    if (port !== undefined) updates.port = port;
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'No fields to update'
      });
    }
    
    await db.update(scales).set(updates).where(eq(scales.id, parseInt(id)));
    
    await logEvent('INFO', 'API', `Scale updated`, 'scale', scale.name, updates);
    
    res.json({
      id: parseInt(id),
      ...updates,
      updated: true
    });
    
  } catch (error) {
    console.error('[API] Error updating scale:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/scales/:id
 * Delete a scale
 */
router.delete('/scales/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const [scale] = await db.select().from(scales).where(eq(scales.id, parseInt(id)));
    
    if (!scale) {
      return res.status(404).json({
        error: 'SCALE_NOT_FOUND',
        message: `Scale with id "${id}" not found`
      });
    }
    
    await db.delete(scales).where(eq(scales.id, parseInt(id)));
    
    await logEvent('INFO', 'API', `Scale deleted`, 'scale', scale.name);
    
    res.json({
      id: parseInt(id),
      deleted: true
    });
    
  } catch (error) {
    console.error('[API] Error deleting scale:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// WEIGHT POLLING HELPERS
// ============================================

const pollingIntervals = new Map<string, NodeJS.Timeout>();

async function startWeightPolling(sessionId: string, scale: typeof scales.$inferSelect) {
  const scaleConfig = {
    ip: scale.ip,
    port: scale.port,
    protocol: scale.protocol as 'SICS' | 'IND' | 'MT-SICS' | 'CUSTOM',
    timeout: 3000
  };
  
  const poll = async () => {
    const session = activeSessions.get(sessionId);
    if (!session || session.status === 'CONFIRMED' || session.status === 'CANCELLED') {
      stopWeightPolling(sessionId);
      return;
    }
    
    try {
      const result = await sicsDriver.readWeightImmediate(scaleConfig);
      
      if (result.success && result.weight !== null) {
        session.status = 'RUNNING';
        session.lastWeight = result.weight;
        session.lastUnit = result.unit || 'kg';
        session.lastStable = result.isStable;
        session.lastRaw = result.rawResponse;
        session.lastWeightAt = new Date();
        
        // Update scale status
        await db.update(scales).set({
          status: 'online',
          lastWeight: result.weight.toString(),
          lastUnit: result.unit,
          lastSeenAt: new Date(),
          lastError: null
        }).where(eq(scales.id, scale.id));
      }
    } catch (e) {
      console.error(`[Polling] Error for session ${sessionId}:`, e);
    }
  };
  
  // Poll every 500ms
  const interval = setInterval(poll, 500);
  pollingIntervals.set(sessionId, interval);
  
  // Initial poll
  poll();
}

function stopWeightPolling(sessionId: string) {
  const interval = pollingIntervals.get(sessionId);
  if (interval) {
    clearInterval(interval);
    pollingIntervals.delete(sessionId);
  }
}

export default router;
