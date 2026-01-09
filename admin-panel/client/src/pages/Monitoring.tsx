import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { Activity, Server, Scale, Printer, Database, Clock, RefreshCw, CheckCircle, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Monitoring() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  // Queries
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = trpc.monitoring.getHealth.useQuery(undefined, {
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: metrics } = trpc.monitoring.getMetrics.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const { data: connector } = trpc.monitoring.getConnectorStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const getHealthIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "unhealthy":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getHealthBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      healthy: "default",
      degraded: "secondary",
      unhealthy: "destructive",
    };
    const labels: Record<string, string> = {
      healthy: "Здоров",
      degraded: "Деградация",
      unhealthy: "Проблемы",
    };
    return (
      <Badge variant={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const formatUptime = (lastSeen: string | null) => {
    if (!lastSeen) return "Неизвестно";
    const diff = Date.now() - new Date(lastSeen).getTime();
    if (diff < 60000) return "Только что";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    return `${Math.floor(diff / 86400000)} дн назад`;
  };

  const handleRefresh = () => {
    refetchHealth();
    utils.monitoring.getMetrics.invalidate();
    utils.monitoring.getConnectorStatus.invalidate();
  };

  if (healthLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('monitoring.title')}</h1>
          <p className="text-muted-foreground">{t('monitoring.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Overall Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {getHealthIcon(health?.health || "unknown")}
              Состояние системы
            </CardTitle>
            {getHealthBadge(health?.health || "unknown")}
          </div>
        </CardHeader>
        <CardContent>
          {health?.issues && health.issues.length > 0 ? (
            <div className="space-y-2">
              {health.issues.map((issue, idx) => (
                <div key={idx} className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{issue}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-green-600 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Все системы работают нормально
            </p>
          )}
        </CardContent>
      </Card>

      {/* Component Status Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Worker Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              Worker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Badge variant={connector?.status === "running" ? "default" : "destructive"}>
                {connector?.status === "running" ? "Работает" : "Остановлен"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Последняя активность: {formatUptime(connector?.lastSeen)}
            </p>
          </CardContent>
        </Card>

        {/* Scales Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Весы
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health?.scales.online || 0} / {health?.scales.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              онлайн
            </p>
            {health?.scales.total && health.scales.online < health.scales.total && (
              <p className="text-xs text-amber-600 mt-1">
                {health.scales.total - health.scales.online} офлайн
              </p>
            )}
          </CardContent>
        </Card>

        {/* Printers Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Printer className="h-4 w-4" />
              Принтеры
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {health?.printers.online || 0} / {health?.printers.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              онлайн
            </p>
          </CardContent>
        </Card>

        {/* Database Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4" />
              База данных
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="default">Подключена</Badge>
            <p className="text-xs text-muted-foreground mt-2">
              MySQL / TiDB
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Метрики
          </CardTitle>
          <CardDescription>
            Текущие показатели системы
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{metrics?.tasksQueued || 0}</div>
              <div className="text-sm text-muted-foreground">В очереди</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{metrics?.tasksRunning || 0}</div>
              <div className="text-sm text-muted-foreground">Выполняется</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{metrics?.tasksDone || 0}</div>
              <div className="text-sm text-muted-foreground">Завершено (24ч)</div>
            </div>
            <div className="text-center p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
              <div className="text-2xl font-bold text-amber-600">{metrics?.tasksStuck || 0}</div>
              <div className="text-sm text-muted-foreground">Застряло</div>
            </div>
          </div>

          {metrics && (
            <div className="mt-6 pt-6 border-t">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Весов онлайн:</span>
                  <span className="ml-2 font-medium">{metrics.scalesOnline || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Принтеров онлайн:</span>
                  <span className="ml-2 font-medium">{metrics.printersOnline || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ошибок (24ч):</span>
                  <span className="ml-2 font-medium">{metrics.tasksFailed || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Обновлено:</span>
                  <span className="ml-2 font-medium">
                    {metrics.ts ? new Date(metrics.ts).toLocaleTimeString() : "-"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Connector Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Статус коннектора
          </CardTitle>
          <CardDescription>
            Подробная информация о фоновом процессе
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Статус:</span>
                <div className="mt-1">
                  <Badge variant={connector?.status === "running" ? "default" : "destructive"}>
                    {connector?.status || "unknown"}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">OneBox:</span>
                <div className="mt-1">
                  <Badge variant={connector?.oneboxConnected ? "default" : "secondary"}>
                    {connector?.oneboxConnected ? "Подключен" : "Отключен"}
                  </Badge>
                </div>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Последняя синхронизация:</span>
                <p className="mt-1 font-medium">
                  {connector?.lastSync ? new Date(connector.lastSync).toLocaleString() : "-"}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Версия:</span>
                <p className="mt-1 font-medium">{connector?.version || "1.0.0"}</p>
              </div>
            </div>

            {connector?.lastError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <p className="text-sm font-medium text-red-600">Последняя ошибка:</p>
                <p className="text-sm text-red-600/80 mt-1">{connector.lastError}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
