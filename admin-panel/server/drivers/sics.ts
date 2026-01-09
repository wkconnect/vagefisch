/**
 * SICS Protocol Driver for Mettler Toledo Scales
 * Supports SICS Level 0 and Level 1 commands
 * 
 * Reference: Mettler Toledo SICS Manual (22019673C)
 */

import net from 'net';

export interface ScaleConfig {
  ip: string;
  port: number;
  protocol: 'SICS' | 'IND' | 'MT-SICS' | 'CUSTOM';
  readCommand?: string;      // Default: 'SI' (immediate weight)
  stableCommand?: string;    // Default: 'S' (stable weight)
  zeroCommand?: string;      // Default: 'Z' (zero)
  displayCommand?: string;   // Default: 'D' (display text)
  timeoutMs?: number;        // Default: 5000
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
 */
export async function displayText(config: ScaleConfig, text: string): Promise<CommandResult> {
  const command = config.displayCommand || 'D';
  // Text must be in quotes, max 20 characters typically
  const sanitizedText = text.substring(0, 20).replace(/"/g, '');
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
  
  return { success: true, response };
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

export default {
  readWeightImmediate,
  readWeightStable,
  waitForStableWeight,
  zeroScale,
  tareScale,
  displayText,
  clearDisplay,
  getScaleInfo,
  getSerialNumber,
  testConnection,
};
