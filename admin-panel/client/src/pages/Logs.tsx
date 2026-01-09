import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "@/contexts/LanguageContext";
import { 
  FileText, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Info,
  Bug,
  Loader2
} from "lucide-react";
import { trpc } from "@/lib/trpc";

type LogLevel = "info" | "warning" | "error";

export default function Logs() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [level, setLevel] = useState<LogLevel | "all">("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading, refetch, isFetching } = trpc.logs.list.useQuery({
    page,
    limit,
    level: level === "all" ? undefined : level,
    search: search || undefined,
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleLevelChange = (value: string) => {
    setLevel(value as LogLevel | "all");
    setPage(1);
  };

  const handleRefresh = () => {
    refetch();
  };

  const getLevelIcon = (logLevel: string) => {
    switch (logLevel) {
      case "info":
        return <Info className="h-4 w-4 text-blue-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getLevelBadge = (logLevel: string) => {
    switch (logLevel) {
      case "info":
        return <Badge variant="default">INFO</Badge>;
      case "warning":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">WARNING</Badge>;
      case "error":
        return <Badge variant="destructive">ERROR</Badge>;
      default:
        return <Badge variant="outline">{logLevel}</Badge>;
    }
  };

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('logs.title')}</h1>
          <p className="text-muted-foreground">{t('logs.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('logs.searchPlaceholder')}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={level} onValueChange={handleLevelChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('logs.filterByLevel')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('logs.allLevels')}</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="h-4 w-4 mr-2" />
              {t('common.search')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('logs.systemLogs')}
          </CardTitle>
          <CardDescription>
            {total > 0 ? t('logs.showingLogs', { 
              from: (page - 1) * limit + 1, 
              to: Math.min(page * limit, total), 
              total: total 
            }) : t('logs.noLogs')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-2" />
              <p>{t('logs.noLogs')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-0.5">
                    {getLevelIcon(log.level)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getLevelBadge(log.level)}
                      <span className="text-sm font-medium">{log.source}</span>
                    </div>
                    <p className="text-sm mt-1 break-words">{log.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                {t('logs.page', { current: page, total: totalPages })}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t('common.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  {t('common.next')}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
