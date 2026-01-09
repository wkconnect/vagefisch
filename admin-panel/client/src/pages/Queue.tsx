import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRole } from "@/contexts/RoleContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { ListTodo, RefreshCw, Scale, Clock, XCircle, GitBranch, Plus, Loader2, CheckCircle, AlertTriangle, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type TaskStatus = "NEW" | "QUEUED" | "RUNNING" | "DONE" | "FAILED" | "STUCK" | "CANCELLED";

interface TaskFormData {
  scaleId?: number;
  printerId?: number;
  routeId?: number;
  externalRef: string;
  sku: string;
  productName: string;
  batch: string;
  targetWeight?: number;
  minWeight?: number;
  maxWeight?: number;
  unit: string;
}

const defaultFormData: TaskFormData = {
  externalRef: "",
  sku: "",
  productName: "",
  batch: "",
  unit: "kg",
};

export default function Queue() {
  const { canEdit } = useRole();
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<TaskFormData>(defaultFormData);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Queries
  const { data: tasksData, isLoading, refetch } = trpc.weighingTasks.list.useQuery({
    page,
    limit: 50,
    status: statusFilter !== "all" ? statusFilter as TaskStatus : undefined,
  });

  const { data: stats } = trpc.weighingTasks.getStats.useQuery();
  const { data: scales = [] } = trpc.scales.list.useQuery();
  const { data: routes = [] } = trpc.routes.list.useQuery();

  // Mutations
  const createMutation = trpc.weighingTasks.create.useMutation({
    onSuccess: (result) => {
      toast.success(`Задача создана: ${result.taskId}`);
      utils.weighingTasks.list.invalidate();
      utils.weighingTasks.getStats.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const retryMutation = trpc.weighingTasks.retry.useMutation({
    onSuccess: () => {
      toast.success("Задача добавлена в очередь повторно");
      utils.weighingTasks.list.invalidate();
      utils.weighingTasks.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelMutation = trpc.weighingTasks.cancel.useMutation({
    onSuccess: () => {
      toast.success("Задача отменена");
      utils.weighingTasks.list.invalidate();
      utils.weighingTasks.getStats.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setFormData(defaultFormData);
  };

  const handleSubmit = () => {
    createMutation.mutate({
      ...formData,
      scaleId: formData.scaleId || undefined,
      printerId: formData.printerId || undefined,
      routeId: formData.routeId || undefined,
    });
  };

  const getStatusBadge = (status: TaskStatus) => {
    const variants: Record<TaskStatus, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: any }> = {
      NEW: { variant: "outline", label: "Новая", icon: Clock },
      QUEUED: { variant: "secondary", label: "В очереди", icon: Clock },
      RUNNING: { variant: "default", label: "Выполняется", icon: Play },
      DONE: { variant: "default", label: "Завершена", icon: CheckCircle },
      FAILED: { variant: "destructive", label: "Ошибка", icon: XCircle },
      STUCK: { variant: "destructive", label: "Застряла", icon: AlertTriangle },
      CANCELLED: { variant: "secondary", label: "Отменена", icon: Pause },
    };

    const config = variants[status] || variants.NEW;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDuration = (startedAt: string | null, finishedAt: string | null) => {
    if (!startedAt) return "-";
    const start = new Date(startedAt).getTime();
    const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
    const seconds = Math.floor((end - start) / 1000);
    if (seconds < 60) return `${seconds}с`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}м ${seconds % 60}с`;
  };

  const tasks = tasksData?.tasks || [];
  const total = tasksData?.total || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('queue.title')}</h1>
          <p className="text-muted-foreground">{t('queue.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('common.refresh')}
          </Button>
          {canEdit && (
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Создать задачу
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Всего</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">Выполняется</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.byStatus?.RUNNING || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">В очереди</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.byStatus?.QUEUED || 0) + (stats?.byStatus?.NEW || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Застряло</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats?.byStatus?.STUCK || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Успешность</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.successRate?.toFixed(1) || 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5" />
                {t('queue.taskQueue')}
              </CardTitle>
              <CardDescription>
                Всего: {total} задач
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Фильтр по статусу" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="NEW">Новые</SelectItem>
                <SelectItem value="QUEUED">В очереди</SelectItem>
                <SelectItem value="RUNNING">Выполняются</SelectItem>
                <SelectItem value="DONE">Завершены</SelectItem>
                <SelectItem value="FAILED">Ошибки</SelectItem>
                <SelectItem value="STUCK">Застряли</SelectItem>
                <SelectItem value="CANCELLED">Отменены</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ListTodo className="h-12 w-12 mb-4" />
              <p>Нет задач</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID задачи</TableHead>
                  <TableHead>SKU / Продукт</TableHead>
                  <TableHead>Весы</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Вес</TableHead>
                  <TableHead>Длительность</TableHead>
                  {canEdit && <TableHead className="text-right">Действия</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task: any) => (
                  <TableRow
                    key={task.id}
                    className={task.status === "STUCK" ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}
                  >
                    <TableCell className="font-mono text-sm">{task.taskId}</TableCell>
                    <TableCell>
                      <div>
                        <span className="font-mono">{task.sku || "-"}</span>
                        {task.productName && (
                          <p className="text-xs text-muted-foreground">{task.productName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {task.scaleId ? (
                        <span className="flex items-center gap-1">
                          <Scale className="h-3 w-3" />
                          #{task.scaleId}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
                    <TableCell>
                      {task.actualWeight ? (
                        <span className="font-mono">
                          {task.actualWeight} {task.unit}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(task.startedAt, task.finishedAt)}
                      </span>
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {["FAILED", "STUCK", "CANCELLED"].includes(task.status) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => retryMutation.mutate({ id: task.id })}
                              disabled={retryMutation.isPending}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Повторить
                            </Button>
                          )}
                          {["NEW", "QUEUED", "RUNNING"].includes(task.status) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => cancelMutation.mutate({ id: task.id })}
                              disabled={cancelMutation.isPending}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {total > 50 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Страница {page} из {Math.ceil(total / 50)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Назад
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * 50 >= total}
                >
                  Вперед
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Task Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Создать задачу взвешивания</DialogTitle>
            <DialogDescription>
              Добавьте новую задачу в очередь
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Артикул товара"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch">Партия</Label>
                <Input
                  id="batch"
                  value={formData.batch}
                  onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                  placeholder="Номер партии"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="productName">Название продукта</Label>
              <Input
                id="productName"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                placeholder="Название товара"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="externalRef">Внешняя ссылка</Label>
              <Input
                id="externalRef"
                value={formData.externalRef}
                onChange={(e) => setFormData({ ...formData, externalRef: e.target.value })}
                placeholder="ID заказа в OneBox"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Весы</Label>
                <Select
                  value={formData.scaleId?.toString() || "auto"}
                  onValueChange={(v) => setFormData({ ...formData, scaleId: v === "auto" ? undefined : parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Авто" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Автоматически</SelectItem>
                    {scales.map((scale: any) => (
                      <SelectItem key={scale.id} value={scale.id.toString()}>
                        {scale.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Маршрут</Label>
                <Select
                  value={formData.routeId?.toString() || "default"}
                  onValueChange={(v) => setFormData({ ...formData, routeId: v === "default" ? undefined : parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="По умолчанию" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">По умолчанию</SelectItem>
                    {routes.map((route: any) => (
                      <SelectItem key={route.id} value={route.id.toString()}>
                        {route.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetWeight">Целевой вес</Label>
                <Input
                  id="targetWeight"
                  type="number"
                  step="0.001"
                  value={formData.targetWeight || ""}
                  onChange={(e) => setFormData({ ...formData, targetWeight: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minWeight">Мин. вес</Label>
                <Input
                  id="minWeight"
                  type="number"
                  step="0.001"
                  value={formData.minWeight || ""}
                  onChange={(e) => setFormData({ ...formData, minWeight: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxWeight">Макс. вес</Label>
                <Input
                  id="maxWeight"
                  type="number"
                  step="0.001"
                  value={formData.maxWeight || ""}
                  onChange={(e) => setFormData({ ...formData, maxWeight: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.000"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
