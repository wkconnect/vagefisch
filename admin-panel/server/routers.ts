import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authenticateUser, createSessionToken } from "./_core/auth";

// Admin-only procedure - requires admin role
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

// Viewer procedure - allows both admin and viewer roles
const viewerProcedure = protectedProcedure;

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    /**
     * Get current user info from session
     */
    me: publicProcedure.query(opts => opts.ctx.user),
    
    /**
     * Login with username and password
     */
    login: publicProcedure
      .input(z.object({
        username: z.string().min(1, "Username is required"),
        password: z.string().min(1, "Password is required"),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await authenticateUser(input.username, input.password);
        
        if (!user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid username or password',
          });
        }
        
        // Create session token
        const token = await createSessionToken(user);
        
        // Set session cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });
        
        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
          },
        };
      }),
    
    /**
     * Logout - clear session cookie
     */
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Dashboard data router
  dashboard: router({
    getStatus: viewerProcedure.query(async () => {
      // Mock data for dashboard - will be replaced with real data later
      return {
        connector: {
          status: 'running' as const,
          uptime: '5d 12h 34m',
        },
        onebox: {
          status: 'connected' as const,
          lastSync: new Date().toISOString(),
        },
        scales: {
          total: 4,
          online: 3,
          offline: 1,
        },
        printers: {
          total: 2,
          online: 2,
          offline: 0,
        },
        queue: {
          active: 12,
          stuck: 2,
        },
        errors: [
          { id: '1', timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), severity: 'error' as const, messageKey: 'errors.scaleConnectionTimeout', messageParams: { scale: 'ICS-001' }, source: 'Scale ICS-001' },
          { id: '2', timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), severity: 'warning' as const, messageKey: 'errors.printQueueExceedsThreshold', messageParams: {}, source: 'Printer ZPL-01' },
          { id: '3', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), severity: 'error' as const, messageKey: 'errors.oneboxApiRateLimit', messageParams: {}, source: 'OneBox' },
          { id: '4', timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), severity: 'warning' as const, messageKey: 'errors.taskStuckMoreThan5Min', messageParams: {}, source: 'Queue' },
          { id: '5', timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), severity: 'info' as const, messageKey: 'errors.scaleReconnectedSuccessfully', messageParams: { scale: 'ICS-002' }, source: 'Scale ICS-002' },
        ],
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
