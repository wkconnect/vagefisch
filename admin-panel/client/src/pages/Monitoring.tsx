import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  Activity,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Printer,
  TrendingUp,
  Timer,
} from "lucide-react";

// Mock data for monitoring
const mockMetrics = {
  uptime: {
    value: "5d 12h 34m",
    percentage: 99.8,
  },
  successRate: {
    value: 98.5,
    trend: "+0.3%",
  },
  queueDepth: {
    current: 14,
    max: 50,
  },
  offlineDevices: {
    scales: 1,
    printers: 0,
  },
  avgTaskDuration: {
    value: "45s",
    trend: "-5s",
  },
};

export default function Monitoring() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('monitoring.title')}</h1>
        <p className="text-muted-foreground">
          {t('monitoring.subtitle')}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Uptime */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {t('monitoring.systemUptime')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockMetrics.uptime.value}</div>
            <div className="mt-2">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">{t('monitoring.availability')}</span>
                <span className="font-medium text-green-600">{mockMetrics.uptime.percentage}%</span>
              </div>
              <Progress value={mockMetrics.uptime.percentage} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              {t('monitoring.successRate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{mockMetrics.successRate.value}%</span>
              <Badge variant="outline" className="text-green-600">
                <TrendingUp className="h-3 w-3 mr-1" />
                {mockMetrics.successRate.trend}
              </Badge>
            </div>
            <div className="mt-2">
              <Progress value={mockMetrics.successRate.value} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('monitoring.successRateDescription')}
            </p>
          </CardContent>
        </Card>

        {/* Queue Depth */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              {t('monitoring.queueDepth')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{mockMetrics.queueDepth.current}</span>
              <span className="text-muted-foreground">/ {mockMetrics.queueDepth.max}</span>
            </div>
            <div className="mt-2">
              <Progress 
                value={(mockMetrics.queueDepth.current / mockMetrics.queueDepth.max) * 100} 
                className="h-2" 
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('monitoring.queueDepthDescription')}
            </p>
          </CardContent>
        </Card>

        {/* Offline Devices */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              {t('monitoring.offlineDevices')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockMetrics.offlineDevices.scales + mockMetrics.offlineDevices.printers}
            </div>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-muted-foreground" />
                <span className={`text-sm ${mockMetrics.offlineDevices.scales > 0 ? "text-amber-600 font-medium" : ""}`}>
                  {mockMetrics.offlineDevices.scales} {t('monitoring.scalesCount')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {mockMetrics.offlineDevices.printers} {t('monitoring.printersCount')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Average Task Duration */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              {t('monitoring.avgTaskDuration')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{mockMetrics.avgTaskDuration.value}</span>
              <Badge variant="outline" className="text-green-600">
                <TrendingUp className="h-3 w-3 mr-1" />
                {mockMetrics.avgTaskDuration.trend}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('monitoring.avgTaskDurationDescription')}
            </p>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              {t('monitoring.systemHealth')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <span className="text-xl font-bold text-green-600">{t('monitoring.healthy')}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('monitoring.allServicesOperational')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t('monitoring.performanceOverview')}</CardTitle>
          <CardDescription>
            {t('monitoring.performanceDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48 bg-muted/30 rounded-lg border border-dashed">
            <p className="text-muted-foreground">
              {t('monitoring.chartsComingSoon')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
