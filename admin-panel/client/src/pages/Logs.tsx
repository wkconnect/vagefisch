import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "@/contexts/LanguageContext";
import { FileText, Download, Search, AlertCircle, AlertTriangle, Info, Filter } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

// Mock data for logs
const mockLogs = [
  { id: "1", timestamp: new Date(Date.now() - 1000 * 60 * 1).toISOString(), severity: "info" as const, source: "Scale ICS-001", taskId: "T-001", message: "Weight reading: 5.234 kg (stable)" },
  { id: "2", timestamp: new Date(Date.now() - 1000 * 60 * 2).toISOString(), severity: "info" as const, source: "Printer ZPL-01", taskId: "T-001", message: "Label printed successfully" },
  { id: "3", timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(), severity: "error" as const, source: "Scale IND-001", taskId: "T-003", message: "Connection timeout after 30s" },
  { id: "4", timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(), severity: "warning" as const, source: "Queue", taskId: null, message: "Task T-003 stuck for more than 5 minutes" },
  { id: "5", timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(), severity: "info" as const, source: "OneBox", taskId: null, message: "Sync completed: 15 tasks received" },
  { id: "6", timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), severity: "warning" as const, source: "Printer ZPL-01", taskId: null, message: "Print queue depth: 8 (threshold: 5)" },
  { id: "7", timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(), severity: "error" as const, source: "OneBox", taskId: null, message: "API rate limit reached, retrying in 60s" },
  { id: "8", timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(), severity: "info" as const, source: "Scale ICS-002", taskId: "T-002", message: "Tare completed: 0.000 kg" },
  { id: "9", timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), severity: "info" as const, source: "Connector", taskId: null, message: "Health check passed" },
  { id: "10", timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(), severity: "info" as const, source: "Scale ICS-002", taskId: null, message: "Reconnected successfully" },
];

export default function Logs() {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

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

  const handleDownload = () => {
    toast.info(t('common.featureComingSoon'));
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return <Badge variant="destructive">{t('logs.errorLevel').toUpperCase()}</Badge>;
      case "warning":
        return <Badge className="bg-amber-500">{t('logs.warning').toUpperCase()}</Badge>;
      default:
        return <Badge variant="secondary">{t('logs.info').toUpperCase()}</Badge>;
    }
  };

  const filteredLogs = mockLogs.filter((log) => {
    const matchesSearch = searchTerm === "" || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.taskId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.source.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === "all" || log.severity === severityFilter;
    const matchesSource = sourceFilter === "all" || log.source === sourceFilter;
    return matchesSearch && matchesSeverity && matchesSource;
  });

  const uniqueSources = Array.from(new Set(mockLogs.map(log => log.source)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('logs.title')}</h1>
          <p className="text-muted-foreground">
            {t('logs.subtitle')}
          </p>
        </div>
        <Button onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          {t('logs.downloadLogs')}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            {t('logs.filters')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('logs.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('logs.severity')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('logs.allSeverity')}</SelectItem>
                <SelectItem value="error">{t('logs.errorLevel')}</SelectItem>
                <SelectItem value="warning">{t('logs.warning')}</SelectItem>
                <SelectItem value="info">{t('logs.info')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('logs.source')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('logs.allSources')}</SelectItem>
                {uniqueSources.map((source) => (
                  <SelectItem key={source} value={source}>{source}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('logs.logEntries')}
          </CardTitle>
          <CardDescription>
            {t('logs.showing', { count: filteredLogs.length, total: mockLogs.length })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className={`p-3 rounded-lg border ${
                    log.severity === "error" 
                      ? "bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-800" 
                      : log.severity === "warning"
                      ? "bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800"
                      : "bg-muted/30 border-border"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-0.5">
                      {getSeverityIcon(log.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {getSeverityBadge(log.severity)}
                        <Badge variant="outline" className="font-mono text-xs">
                          {log.source}
                        </Badge>
                        {log.taskId && (
                          <Badge variant="outline" className="font-mono text-xs">
                            {log.taskId}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatTimeAgo(new Date(log.timestamp))}
                        </span>
                      </div>
                      <p className="text-sm">{log.message}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
