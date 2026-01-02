import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Printer,
  Scale,
  Server,
  XCircle,
  Zap,
  Clock,
  ListTodo,
} from "lucide-react";

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: status, isLoading } = trpc.dashboard.getStatus.useQuery();

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return t('time.lessThanMinute');
    if (diffMins < 60) return t('time.minutesAgo', { count: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('time.hoursAgo', { count: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    return t('time.daysAgo', { count: diffDays });
  };

  if (isLoading) {
    return <DashboardSkeleton t={t} />;
  }

  if (!status) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">{t('errors.failedToLoad')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground">
          {t('dashboard.subtitle')}
        </p>
      </div>

      {/* Status Cards Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Connector Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.connector')}</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {status.connector.status === "running" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-xl font-bold text-green-600">{t('common.running')}</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-xl font-bold text-red-600">{t('common.stopped')}</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3 inline mr-1" />
              {t('dashboard.uptime')}: {status.connector.uptime}
            </p>
          </CardContent>
        </Card>

        {/* OneBox Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.onebox')}</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {status.onebox.status === "connected" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-xl font-bold text-green-600">{t('common.connected')}</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-xl font-bold text-red-600">{t('common.disconnected')}</span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('dashboard.lastSync')}: {formatTimeAgo(new Date(status.onebox.lastSync))}
            </p>
          </CardContent>
        </Card>

        {/* Scales Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.scales')}</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.scales.total}</div>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {status.scales.online} {t('common.online').toLowerCase()}
              </span>
              <span className="flex items-center gap-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                {status.scales.offline} {t('common.offline').toLowerCase()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Printers Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.printers')}</CardTitle>
            <Printer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status.printers.total}</div>
            <div className="flex items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                {status.printers.online} {t('common.online').toLowerCase()}
              </span>
              <span className="flex items-center gap-1 text-xs">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                {status.printers.offline} {t('common.offline').toLowerCase()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue and Errors Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Queue Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5" />
              {t('dashboard.queueStatus')}
            </CardTitle>
            <CardDescription>{t('dashboard.queueOverview')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('dashboard.activeTasks')}</p>
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  <span className="text-3xl font-bold">{status.queue.active}</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{t('dashboard.stuckTasks')}</p>
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`h-5 w-5 ${status.queue.stuck > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                  <span className={`text-3xl font-bold ${status.queue.stuck > 0 ? "text-amber-600" : ""}`}>
                    {status.queue.stuck}
                  </span>
                </div>
              </div>
            </div>
            {status.queue.stuck > 0 && (
              <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {status.queue.stuck} {t('dashboard.tasksRequireAttention')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Errors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {t('dashboard.recentErrors')}
            </CardTitle>
            <CardDescription>{t('dashboard.lastSystemEvents')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-3">
                {status.errors.map((error) => (
                  <div
                    key={error.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="shrink-0 mt-0.5">
                      {error.severity === "error" && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      {error.severity === "warning" && (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                      {error.severity === "info" && (
                        <Info className="h-4 w-4 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t(error.messageKey, error.messageParams as Record<string, string | number>)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {error.source}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(new Date(error.timestamp))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DashboardSkeleton({ t }: { t: (key: string) => string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-20 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
