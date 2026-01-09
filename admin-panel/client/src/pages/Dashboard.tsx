import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { 
  Activity, 
  Scale, 
  Printer, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock,
  RefreshCw,
  Server,
  Database,
  Loader2
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Dashboard() {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  
  const { data: status, isLoading, refetch, isFetching } = trpc.dashboard.getStatus.useQuery(undefined, {
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleRefresh = () => {
    refetch();
    utils.dashboard.getStatus.invalidate();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "running":
      case "connected":
      case "online":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "stopped":
      case "disconnected":
      case "offline":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "error":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
      case "connected":
      case "online":
        return <Badge variant="default">{t(`status.${status}`)}</Badge>;
      case "stopped":
      case "disconnected":
      case "offline":
        return <Badge variant="destructive">{t(`status.${status}`)}</Badge>;
      case "error":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">{t('status.error')}</Badge>;
      default:
        return <Badge variant="outline">{t('status.unknown')}</Badge>;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "error":
      case "critical":
        return "text-red-600 bg-red-50 dark:bg-red-950/20";
      case "warning":
        return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20";
      default:
        return "text-blue-600 bg-blue-50 dark:bg-blue-950/20";
    }
  };

  if (isLoading) {
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
          <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* System Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Connector Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.connector')}</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusIcon(status?.connector.status || 'unknown')}
              {getStatusBadge(status?.connector.status || 'unknown')}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('dashboard.uptime')}: {status?.connector.uptime || 'N/A'}
            </p>
          </CardContent>
        </Card>

        {/* OneBox Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.onebox')}</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getStatusIcon(status?.onebox.status || 'unknown')}
              {getStatusBadge(status?.onebox.status || 'unknown')}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {status?.onebox.lastSync 
                ? `${t('dashboard.lastSync')}: ${new Date(status.onebox.lastSync).toLocaleString()}`
                : t('dashboard.neverSynced')
              }
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
            <div className="text-2xl font-bold">
              {status?.scales.online || 0}/{status?.scales.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.online')}
            </p>
            {(status?.scales.offline || 0) > 0 && (
              <p className="text-xs text-red-500 mt-1">
                {status?.scales.offline} {t('dashboard.offline')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Printers Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.printers')}</CardTitle>
            <Printer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.printers.online || 0}/{status?.printers.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.online')}
            </p>
            {(status?.printers.offline || 0) > 0 && (
              <p className="text-xs text-red-500 mt-1">
                {status?.printers.offline} {t('dashboard.offline')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Queue Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            {t('dashboard.queueStatus')}
          </CardTitle>
          <CardDescription>{t('dashboard.queueDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{status?.queue.active || 0}</div>
              <div className="text-sm text-muted-foreground">{t('queue.active')}</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-950/20 rounded-lg">
              <div className="text-2xl font-bold">{status?.queue.pending || 0}</div>
              <div className="text-sm text-muted-foreground">{t('queue.pending')}</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{status?.queue.stuck || 0}</div>
              <div className="text-sm text-muted-foreground">{t('queue.stuck')}</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{status?.queue.failed || 0}</div>
              <div className="text-sm text-muted-foreground">{t('queue.failed')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Errors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {t('dashboard.recentErrors')}
          </CardTitle>
          <CardDescription>{t('dashboard.recentErrorsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {(!status?.errors || status.errors.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mb-2 text-green-500" />
              <p>{t('dashboard.noErrors')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {status.errors.map((error) => (
                <div
                  key={error.id}
                  className={`p-3 rounded-lg ${getSeverityColor(error.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{error.message}</p>
                      <p className="text-xs mt-1 opacity-75">
                        {error.source} • {new Date(error.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {error.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
