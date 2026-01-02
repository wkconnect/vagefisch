import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRole } from "@/contexts/RoleContext";
import { useTranslation } from "@/contexts/LanguageContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListTodo, XCircle, RefreshCw, GitBranch, Clock, Scale, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

// Mock data for tasks
const mockTasks = [
  { id: "T-001", sku: "12345-A", scale: "ICS-001", status: "active" as const, startedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(), duration: "2m 15s" },
  { id: "T-002", sku: "67890-B", scale: "ICS-002", status: "active" as const, startedAt: new Date(Date.now() - 1000 * 60 * 1).toISOString(), duration: "1m 30s" },
  { id: "T-003", sku: "11111-C", scale: "IND-001", status: "stuck" as const, startedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(), duration: "8m 45s" },
  { id: "T-004", sku: "22222-D", scale: "ICS-003", status: "active" as const, startedAt: new Date(Date.now() - 1000 * 30).toISOString(), duration: "0m 30s" },
  { id: "T-005", sku: "33333-E", scale: "ICS-001", status: "pending" as const, startedAt: null, duration: "-" },
  { id: "T-006", sku: "44444-F", scale: "ICS-002", status: "stuck" as const, startedAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(), duration: "6m 10s" },
];

export default function Queue() {
  const { canEdit } = useRole();
  const { t } = useTranslation();

  const handleAction = (action: string, taskId?: string) => {
    toast.info(t('common.featureComingSoon'));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-blue-500">{t('common.active')}</Badge>;
      case "stuck":
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {t('common.stuck')}
        </Badge>;
      case "pending":
        return <Badge variant="secondary">{t('common.pending')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('queue.title')}</h1>
          <p className="text-muted-foreground">
            {t('queue.subtitle')}
          </p>
        </div>
        <Button variant="outline" onClick={() => handleAction("Refresh")}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('common.refresh')}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.activeTasks')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {mockTasks.filter(t => t.status === "active").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('queue.pendingTasks')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mockTasks.filter(t => t.status === "pending").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">{t('dashboard.stuckTasks')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {mockTasks.filter(t => t.status === "stuck").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5" />
            {t('queue.taskQueue')}
          </CardTitle>
          <CardDescription>{t('queue.allTasks')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('queue.taskId')}</TableHead>
                <TableHead>{t('queue.sku')}</TableHead>
                <TableHead>{t('queue.scale')}</TableHead>
                <TableHead>{t('queue.status')}</TableHead>
                <TableHead>{t('queue.duration')}</TableHead>
                {canEdit && <TableHead className="text-right">{t('queue.actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTasks.map((task) => (
                <TableRow key={task.id} className={task.status === "stuck" ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                  <TableCell className="font-mono">{task.id}</TableCell>
                  <TableCell className="font-mono">{task.sku}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      <Scale className="h-3 w-3" />
                      {task.scale}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(task.status)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {task.duration}
                    </span>
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {task.status === "stuck" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction("Retry", task.id)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            {t('queue.retry')}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAction("Re-route", task.id)}
                        >
                          <GitBranch className="h-3 w-3 mr-1" />
                          {t('queue.reroute')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleAction("Cancel", task.id)}
                        >
                          <XCircle className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
