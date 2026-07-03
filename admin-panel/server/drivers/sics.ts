/**
 * SICS Protocol Driver for Mettler Toledo Scales
 * Supports SICS Level 0 and Level 1 commands
 * 
 * Reference: Mettler Toledo SICS Manual (22019673C)
 * 
 * Display limitations by model:
 * - ICS689-B60: max 12 characters, single line
 * - Other models: typically 20 characters
 */

import net from 'net';

export interface DisplayConfig {
  maxCharsPerLine: number;  // Default: 12 for ICS689
  maxLines: number;         // Default: 1 (single line Remote-Anzeige)
  rotationIntervalMs: number; // Default: 2500ms between rotations
}

export interface ScaleConfig {
  ip: string;
  port: number;
  protocol: 'SICS' | 'IND' | 'MT-SICS' | 'CUSTOM';
  readCommand?: string;      // Default: 'SI' (immediate weight)
  stableCommand?: string;    // Default: 'S' (stable weight)
  zeroCommand?: string;      // Default: 'Z' (zero)
  displayCommand?: string;   // Default: 'D' (display text)
  timeoutMs?: number;        // Default: 5000
  display?: DisplayConfig;   // Display configuration
}

export interface WeightResult {
  success: boolean;
  weight?: number;
  unit?: string;
  isStable?: boolean;
  rawResponse?: string;
  error?: string;
  errorCode?: string;
  latencyMs?: number;
}

export interface CommandResult {
  success: boolean;
  response?: string;
  error?: string;
  errorCode?: string;
}

export interface DisplayPayload {
  productName: string;
  sku?: string;
  targetWeight?: number;
  currentWeight?: number;
  unit?: string;
  batchId?: string;
}

// Default display config for ICS689
const DEFAULT_DISPLAY_CONFIG: DisplayConfig = {
  maxCharsPerLine: 12,
  maxLines: 1,
  rotationIntervalMs: 2500
};

/**
 * Build display lines from payload
 * Creates array of lines that fit within maxCharsPerLine
 */
export function buildDisplayLines(payload: DisplayPayload, config: DisplayConfig = DEFAULT_DISPLAY_CONFIG): string[] {
  const lines: string[] = [];
  const maxLen = config.maxCharsPerLine;
  
  // Line 1: Product name (truncated if needed)
  if (payload.productName) {
    const name = payload.productName.substring(0, maxLen);
    lines.push(name);
  }
  
  // Line 2: SKU (abbreviated)
  if (payload.sku) {
    const sku = payload.sku.length > maxLen 
      ? payload.sku.substring(0, maxLen)
      : payload.sku;
    lines.push(sku);
  }
  
  // Line 3: Target weight (Soll)
  if (payload.targetWeight !== undefined) {
    const unit = payload.unit || 'kg';
    const sollText = `S:${payload.targetWeight}${unit}`;
    lines.push(sollText.substring(0, maxLen));
  }
  
  // Line 4: Current weight (Ist)
  if (payload.currentWeight !== undefined) {
    const unit = payload.unit || 'kg';
    const istText = `I:${payload.currentWeight}${unit}`;
    lines.push(istText.substring(0, maxLen));
  }
  
  // Line 5: Batch ID
  if (payload.batchId) {
    const batch = `B:${payload.batchId}`;
    lines.push(batch.substring(0, maxLen));
  }
  
  return lines;
}

/**
 * Format single display text from payload
 * For single-line displays, creates compact format
 */
export function formatDisplayText(payload: DisplayPayload, config: DisplayConfig = DEFAULT_DISPLAY_CONFIG): string {
  const maxLen = config.maxCharsPerLine;
  
  // For single line display, prioritize product name
  if (payload.productName) {
    return payload.productName.substring(0, maxLen);
  }
  
  return '';
}

/**
 * Parse SICS weight response
 * Format: "S S 10.234 kg" or "S D 10.234 kg" (S=stable, D=dynamic)
 * Error responses: "S I" (command understood, not executable), "S +" (overload), "S -" (underload)
 */
function parseSicsResponse(response: string): WeightResult {
  const trimmed = response.trim();
  
  // Check for error responses
  if (trimmed.includes(' I')) {
    return { success: false, error: 'Command not executable at this time', errorCode: 'SICS_I', rawResponse: trimmed };
  }
  if (trimmed.includes(' +')) {
    return { success: false, error: 'Scale overload', errorCode: 'SICS_OVERLOAD', rawResponse: trimmed };
  }
  if (trimmed.includes(' -')) {
    return { success: false, error: 'Scale underload', errorCode: 'SICS_UNDERLOAD', rawResponse: trimmed };
  }
  
  // Parse weight response: "S S 10.234 kg" or "SI S 10.234 kg"
  // Format: <command> <status> <weight> <unit>
  const parts = trimmed.split(/\s+/);
  
  if (parts.length >= 4) {
    const status = parts[1]; // S = stable, D = dynamic
    const weightStr = parts[2];
    const unit = parts[3];
    
    const weight = parseFloat(weightStr);
    if (!isNaN(weight)) {
      return {
        success: true,
        weight,
        unit,
        isStable: status === 'S',
        rawResponse: trimmed,
      };
    }
  }
  
  // Try alternative format: just "S 10.234 kg"
  if (parts.length >= 3) {
    const weightStr = parts[1];
    const unit = parts[2];
    
    const weight = parseFloat(weightStr);
    if (!isNaN(weight)) {
      return {
        success: true,
        weight,
        unit,
        isStable: true,
        rawResponse: trimmed,
      };
    }
  }
  
  return { success: false, error: `Unable to parse response: ${trimmed}`, errorCode: 'PARSE_ERROR', rawResponse: trimmed };
}

/**
 * Send command to scale and receive response
 */
async function sendCommand(config: ScaleConfig, command: string): Promise<CommandResult> {
  const timeout = config.timeoutMs || 5000;
  
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let responseBuffer = '';
    let resolved = false;
    
    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
      }
    };
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      // Send command with CRLF terminator (SICS standard)
      socket.write(`${command}\r\n`);
    });
    
    socket.on('data', (data) => {
      responseBuffer += data.toString();
      
      // SICS responses end with CRLF
      if (responseBuffer.includes('\r\n') || responseBuffer.includes('\n')) {
        cleanup();
        resolve({ success: true, response: responseBuffer.trim() });
      }
    });
    
    socket.on('timeout', () => {
      cleanup();
      resolve({ success: false, error: 'Connection timeout', errorCode: 'ETIMEDOUT' });
    });
    
    socket.on('error', (err: NodeJS.ErrnoException) => {
      cleanup();
      resolve({ success: false, error: err.message, errorCode: err.code || 'UNKNOWN' });
    });
    
    socket.on('close', () => {
      if (!resolved) {
        resolved = true;
        if (responseBuffer) {
          resolve({ success: true, response: responseBuffer.trim() });
        } else {
          resolve({ success: false, error: 'Connection closed without response', errorCode: 'ECONNRESET' });
        }
      }
    });
    
    socket.connect(config.port, config.ip);
  });
}

/**
 * Read weight immediately (may be dynamic/unstable)
 * SICS Command: SI (Send weight value Immediately)
 */
export async function readWeightImmediate(config: ScaleConfig): Promise<WeightResult> {
  const startTime = Date.now();
  const command = config.readCommand || 'SI';
  
  const result = await sendCommand(config, command);
  const latencyMs = Date.now() - startTime;
  
  if (!result.success) {
    return { success: false, error: result.error, errorCode: result.errorCode, latencyMs };
  }
  
  const parsed = parseSicsResponse(result.response!);
  return { ...parsed, latencyMs };
}

/**
 * Read stable weight (waits for scale to stabilize)
 * SICS Command: S (Send stable weight value)
 */
export async function readWeightStable(config: ScaleConfig): Promise<WeightResult> {
  const startTime = Date.now();
  const command = config.stableCommand || 'S';
  
  // Stable weight command may take longer
  const stableConfig = { ...config, timeoutMs: Math.max(config.timeoutMs || 5000, 10000) };
  
  const result = await sendCommand(stableConfig, command);
  const latencyMs = Date.now() - startTime;
  
  if (!result.success) {
    return { success: false, error: result.error, errorCode: result.errorCode, latencyMs };
  }
  
  const parsed = parseSicsResponse(result.response!);
  return { ...parsed, latencyMs };
}

/**
 * Wait for stable weight with polling
 * Polls SI command until weight is stable or timeout
 */
export async function waitForStableWeight(config: ScaleConfig, maxWaitMs: number = 30000): Promise<WeightResult> {
  const startTime = Date.now();
  const pollInterval = 500; // Poll every 500ms
  
  while (Date.now() - startTime < maxWaitMs) {
    const result = await readWeightImmediate(config);
    
    if (!result.success) {
      return result;
    }
    
    if (result.isStable) {
      return { ...result, latencyMs: Date.now() - startTime };
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  return { 
    success: false, 
    error: 'Timeout waiting for stable weight', 
    errorCode: 'STABILITY_TIMEOUT',
    latencyMs: Date.now() - startTime 
  };
}

/**
 * Zero the scale
 * SICS Command: Z (Zero)
 */
export async function zeroScale(config: ScaleConfig): Promise<CommandResult> {
  const command = config.zeroCommand || 'Z';
  const result = await sendCommand(config, command);
  
  if (!result.success) {
    return result;
  }
  
  // Check response: "Z A" = accepted, "Z I" = not executable, "Z +" = overload
  const response = result.response || '';
  if (response.includes(' A')) {
    return { success: true, response };
  }
  if (response.includes(' I')) {
    return { success: false, error: 'Zero command not executable (scale not stable or in motion)', errorCode: 'SICS_I', response };
  }
  if (response.includes(' +')) {
    return { success: false, error: 'Cannot zero: scale overload', errorCode: 'SICS_OVERLOAD', response };
  }
  
  return { success: true, response };
}

/**
 * Tare the scale
 * SICS Command: T (Tare)
 */
export async function tareScale(config: ScaleConfig): Promise<CommandResult> {
  const result = await sendCommand(config, 'T');
  
  if (!result.success) {
    return result;
  }
  
  const response = result.response || '';
  if (response.includes(' A') || response.includes(' S')) {
    return { success: true, response };
  }
  if (response.includes(' I')) {
    return { success: false, error: 'Tare command not executable', errorCode: 'SICS_I', response };
  }
  if (response.includes(' +')) {
    return { success: false, error: 'Cannot tare: scale overload', errorCode: 'SICS_OVERLOAD', response };
  }
  
  return { success: true, response };
}

/**
 * Display text on scale display
 * SICS Command: D "text" (Display text)
 * 
 * Note: ICS689-B60 supports max 12 characters
 */
export async function displayText(config: ScaleConfig, text: string): Promise<CommandResult> {
  const command = config.displayCommand || 'D';
  const displayConfig = config.display || DEFAULT_DISPLAY_CONFIG;
  
  // Sanitize and truncate text to max length
  const maxLen = displayConfig.maxCharsPerLine;
  const sanitizedText = text.substring(0, maxLen).replace(/"/g, '');
  
  const result = await sendCommand(config, `${command} "${sanitizedText}"`);
  
  if (!result.success) {
    return result;
  }
  
  const response = result.response || '';
  if (response.includes(' A')) {
    return { success: true, response };
  }
  if (response.includes(' I')) {
    return { success: false, error: 'Display command not supported', errorCode: 'SICS_I', response };
  }
  if (response.includes(' R')) {
    return { success: false, error: `Text too long (max ${maxLen} chars)`, errorCode: 'SICS_R', response };
  }
  if (response.includes(' L')) {
    return { success: false, error: 'Display command failed', errorCode: 'SICS_L', response };
  }
  
  return { success: true, response };
}

/**
 * Display structured payload with rotation
 * Sends multiple lines sequentially with delay
 */
export async function displayPayloadWithRotation(
  config: ScaleConfig, 
  payload: DisplayPayload,
  rotations: number = 2
): Promise<{ success: boolean; linesSent: string[]; errors: string[] }> {
  const displayConfig = config.display || DEFAULT_DISPLAY_CONFIG;
  const lines = buildDisplayLines(payload, displayConfig);
  const linesSent: string[] = [];
  const errors: string[] = [];
  
  for (let r = 0; r < rotations; r++) {
    for (const line of lines) {
      const result = await displayText(config, line);
      if (result.success) {
        linesSent.push(line);
      } else {
        errors.push(`Failed to display "${line}": ${result.error}`);
      }
      
      // Wait between lines
      await new Promise(resolve => setTimeout(resolve, displayConfig.rotationIntervalMs));
    }
  }
  
  return { success: errors.length === 0, linesSent, errors };
}

/**
 * Display single line from payload (for initial display)
 */
export async function displayPayload(config: ScaleConfig, payload: DisplayPayload): Promise<CommandResult> {
  const displayConfig = config.display || DEFAULT_DISPLAY_CONFIG;
  const text = formatDisplayText(payload, displayConfig);
  return await displayText(config, text);
}

/**
 * Clear display (return to weight display)
 * SICS Command: DW (Display Weight)
 */
export async function clearDisplay(config: ScaleConfig): Promise<CommandResult> {
  return await sendCommand(config, 'DW');
}

/**
 * Get scale identification
 * SICS Command: I0 (Identification)
 */
export async function getScaleInfo(config: ScaleConfig): Promise<CommandResult> {
  return await sendCommand(config, 'I0');
}

/**
 * Get scale model info
 * SICS Command: I11 (Model)
 */
export async function getScaleModel(config: ScaleConfig): Promise<CommandResult> {
  return await sendCommand(config, 'I11');
}

/**
 * Get scale serial number
 * SICS Command: I4 (Serial number)
 */
export async function getSerialNumber(config: ScaleConfig): Promise<CommandResult> {
  return await sendCommand(config, 'I4');
}

/**
 * Test connection to scale
 */
export async function testConnection(config: ScaleConfig): Promise<{ success: boolean; latencyMs?: number; error?: string }> {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = config.timeoutMs || 5000;
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      const latencyMs = Date.now() - startTime;
      socket.destroy();
      resolve({ success: true, latencyMs });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ success: false, error: 'Connection timeout' });
    });
    
    socket.on('error', (err: NodeJS.ErrnoException) => {
      socket.destroy();
      resolve({ success: false, error: err.message });
    });
    
    socket.connect(config.port, config.ip);
  });
}

/**
 * Detect display capabilities of scale
 * Tests different text lengths to find max supported
 */
export async function detectDisplayCapabilities(config: ScaleConfig): Promise<{ maxChars: number; model?: string }> {
  // Get model info first
  const modelResult = await getScaleModel(config);
  const model = modelResult.success ? modelResult.response?.match(/"([^"]+)"/)?.[1] : undefined;
  
  // Test different lengths
  let maxChars = 20; // Default assumption
  
  for (let len = 20; len >= 8; len--) {
    const testText = 'A'.repeat(len);
    const result = await displayText({ ...config, display: { maxCharsPerLine: 100, maxLines: 1, rotationIntervalMs: 2500 } }, testText);
    
    if (result.success && result.response?.includes(' A')) {
      maxChars = len;
      break;
    }
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  // Clear display after test
  await clearDisplay(config);
  
  return { maxChars, model };
}

/**
 * Inquiry/preset of tare weight value
 * SICS Command: TA (inquiry) or TA <value> <unit> (preset a known tare)
 */
export async function presetTare(config: ScaleConfig, value?: number, unit: string = 'kg'): Promise<CommandResult> {
  const cmd = value !== undefined ? `TA ${value} ${unit}` : 'TA';
  const result = await sendCommand(config, cmd);
  if (!result.success) return result;
  const response = result.response || '';
  if (response.includes(' A')) return { success: true, response };
  if (response.includes(' I')) return { success: false, error: 'Tare not executable (scale busy or in motion)', errorCode: 'SICS_I', response };
  if (response.includes(' L')) return { success: false, error: 'Wrong or missing tare parameter', errorCode: 'SICS_L', response };
  return { success: true, response };
}

/**
 * Clear tare value
 * SICS Command: TAC
 */
export async function clearTare(config: ScaleConfig): Promise<CommandResult> {
  const result = await sendCommand(config, 'TAC');
  if (!result.success) return result;
  const response = result.response || '';
  if (response.includes('TAC A')) return { success: true, response };
  if (response.includes('TAC I')) return { success: false, error: 'Clear tare not executable', errorCode: 'SICS_I', response };
  return { success: true, response };
}

export interface NetInfoResult {
  success: boolean;
  weight?: number;
  isStable?: boolean;
  belowMinWeigh?: boolean;
  overload?: boolean;
  underload?: boolean;
  rawResponse?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Inquiry of current net information WITH status in a single call.
 * SICS Command: SIS -> "SIS A <status> \"value\" unit dec step app info"
 * status: 0=stable, 1=dynamic, 2=stable<MinWeigh, 3=dyn<MinWeigh, 4=overload, 5=underload, 6=error
 * Preferred over SI when you need weight + stability + over/underload atomically.
 */
export async function sendNetInfo(config: ScaleConfig): Promise<NetInfoResult> {
  const result = await sendCommand(config, 'SIS');
  if (!result.success) return { success: false, error: result.error, errorCode: result.errorCode };
  const resp = (result.response || '').trim();
  const m = resp.match(/SIS\s+A\s+(\d)\s+"([^"]*)"/);
  if (!m) return { success: false, error: `Unable to parse SIS: ${resp}`, errorCode: 'PARSE_ERROR', rawResponse: resp };
  const status = Number(m[1]);
  const weight = parseFloat(m[2]);
  return {
    success: status <= 3,
    weight: isNaN(weight) ? undefined : weight,
    isStable: status === 0 || status === 2,
    belowMinWeigh: status === 2 || status === 3,
    overload: status === 4,
    underload: status === 5,
    rawResponse: resp,
  };
}

/**
 * Stream weight values continuously (SICS Command: SIR - send immediately and repeat).
 * Opens a persistent socket, sends SIR, and invokes onWeight for every value the
 * scale pushes, until stop() is called. Use for a live weight display instead of
 * polling SI. Any other send command / hardware break cancels SIR scale-side;
 * we send a plain 'S' then close the socket.
 */
export function streamWeights(
  config: ScaleConfig,
  onWeight: (w: WeightResult) => void,
  onError?: (err: string) => void,
): { stop: () => void } {
  const socket = new net.Socket();
  let buffer = '';
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try { socket.write('S\r\n'); } catch { /* ignore */ }
    socket.destroy();
  };
  socket.on('connect', () => socket.write('SIR\r\n'));
  socket.on('data', (data) => {
    buffer += data.toString();
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) onWeight(parseSicsResponse(line));
    }
  });
  socket.on('error', (err: NodeJS.ErrnoException) => onError?.(err.message));
  socket.connect(config.port, config.ip);
  return { stop };
}

export default {
  readWeightImmediate,
  readWeightStable,
  waitForStableWeight,
  zeroScale,
  tareScale,
  presetTare,
  setTare: presetTare, // alias: queue-worker.ts calls sicsDriver.setTare(config, value)
  clearTare,
  sendCommand, // exposed for raw-command route steps in queue-worker.ts
  sendNetInfo,
  streamWeights,
  displayText,
  displayPayload,
  displayPayloadWithRotation,
  buildDisplayLines,
  formatDisplayText,
  clearDisplay,
  getScaleInfo,
  getScaleModel,
  getSerialNumber,
  testConnection,
  detectDisplayCapabilities,
};
