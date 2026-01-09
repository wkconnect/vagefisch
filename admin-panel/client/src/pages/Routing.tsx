import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRole } from "@/contexts/RoleContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { 
  GitBranch, Plus, Settings, Trash2, Scale, ArrowRight, Loader2, 
  PlayCircle, ListOrdered, ChevronUp, ChevronDown, GripVertical,
  Zap, Monitor, Printer, Send, Clock, Target, RotateCcw, Code
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface RouteFormData {
  name: string;
  description: string;
  isActive: boolean;
  isDefault: boolean;
}

interface StepFormData {
  actionType: string;
  payloadJson: Record<string, any>;
  timeoutMs: number;
  onErrorAction: string;
}

const defaultFormData: RouteFormData = {
  name: "",
  description: "",
  isActive: true,
  isDefault: false,
};

const defaultStepFormData: StepFormData = {
  actionType: "WEIGH",
  payloadJson: {},
  timeoutMs: 5000,
  onErrorAction: "STOP",
};

const ACTION_TYPES = [
  { value: "WEIGH", label: "Взвешивание (немедленное)", icon: Scale, description: "Команда SI - мгновенное чтение веса" },
  { value: "WEIGH_STABLE", label: "Взвешивание (стабильное)", icon: Scale, description: "Команда S - ожидание стабильного веса" },
  { value: "DISPLAY", label: "Показать на дисплее", icon: Monitor, description: "Команда D - вывод текста на дисплей весов" },
  { value: "PRINT", label: "Печать этикетки", icon: Printer, description: "Отправка на принтер этикеток" },
  { value: "SEND_TO_ONEBOX", label: "Отправить в OneBox", icon: Send, description: "Отправка результата в CRM" },
  { value: "WAIT", label: "Ожидание", icon: Clock, description: "Пауза перед следующим шагом" },
  { value: "ZERO", label: "Обнуление весов", icon: Target, description: "Команда Z - обнуление весов" },
  { value: "TARE", label: "Тарирование", icon: RotateCcw, description: "Команда T - установка тары" },
  { value: "CUSTOM", label: "Пользовательское", icon: Code, description: "Произвольная SICS команда" },
];

const ERROR_ACTIONS = [
  { value: "STOP", label: "Остановить выполнение" },
  { value: "SKIP", label: "Пропустить и продолжить" },
  { value: "RETRY", label: "Повторить шаг" },
];

export default function Routing() {
  const { canEdit } = useRole();
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<any | null>(null);
  const [formData, setFormData] = useState<RouteFormData>(defaultFormData);
  
  // Steps dialog state
  const [isStepsDialogOpen, setIsStepsDialogOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<any | null>(null);
  const [isAddStepDialogOpen, setIsAddStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<any | null>(null);
  const [stepFormData, setStepFormData] = useState<StepFormData>(defaultStepFormData);

  // Queries
  const { data: routes = [], isLoading } = trpc.routes.list.useQuery();
  const { data: scales = [] } = trpc.scales.list.useQuery();
  const { data: printers = [] } = trpc.printers.list.useQuery();
  
  // Steps query - only when route is selected
  const { data: stepsData, isLoading: stepsLoading, refetch: refetchSteps } = trpc.routes.listSteps.useQuery(
    { routeId: selectedRoute?.id || 0 },
    { enabled: !!selectedRoute?.id }
  );

  // Route mutations
  const createMutation = trpc.routes.create.useMutation({
    onSuccess: () => {
      toast.success("Маршрут создан");
      utils.routes.list.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.routes.update.useMutation({
    onSuccess: () => {
      toast.success("Маршрут обновлен");
      utils.routes.list.invalidate();
      closeDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.routes.delete.useMutation({
    onSuccess: () => {
      toast.success("Маршрут удален");
      utils.routes.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Step mutations
  const addStepMutation = trpc.routes.addStep.useMutation({
    onSuccess: () => {
      toast.success("Шаг добавлен");
      refetchSteps();
      closeStepDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateStepMutation = trpc.routes.updateStep.useMutation({
    onSuccess: () => {
      toast.success("Шаг обновлен");
      refetchSteps();
      closeStepDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteStepMutation = trpc.routes.deleteStep.useMutation({
    onSuccess: () => {
      toast.success("Шаг удален");
      refetchSteps();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const reorderStepsMutation = trpc.routes.reorderSteps.useMutation({
    onSuccess: () => {
      toast.success("Порядок шагов обновлен");
      refetchSteps();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingRoute(null);
    setFormData(defaultFormData);
  };

  const closeStepDialog = () => {
    setIsAddStepDialogOpen(false);
    setEditingStep(null);
    setStepFormData(defaultStepFormData);
  };

  const openCreateDialog = () => {
    setEditingRoute(null);
    setFormData(defaultFormData);
    setIsDialogOpen(true);
  };

  const openEditDialog = (route: any) => {
    setEditingRoute(route);
    setFormData({
      name: route.name,
      description: route.description || "",
      isActive: route.isActive,
      isDefault: route.isDefault,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error("Введите название маршрута");
      return;
    }

    if (editingRoute) {
      updateMutation.mutate({
        id: editingRoute.id,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (route: any) => {
    if (confirm(`Удалить маршрут "${route.name}"?`)) {
      deleteMutation.mutate({ id: route.id });
    }
  };

  const openStepsDialog = (route: any) => {
    setSelectedRoute(route);
    setIsStepsDialogOpen(true);
  };

  const openAddStepDialog = () => {
    setEditingStep(null);
    setStepFormData(defaultStepFormData);
    setIsAddStepDialogOpen(true);
  };

  const openEditStepDialog = (step: any) => {
    setEditingStep(step);
    setStepFormData({
      actionType: step.actionType,
      payloadJson: step.payloadJson || {},
      timeoutMs: step.timeoutMs || 5000,
      onErrorAction: step.onErrorAction || "STOP",
    });
    setIsAddStepDialogOpen(true);
  };

  const handleStepSubmit = () => {
    if (!selectedRoute) return;

    const steps = stepsData?.steps || [];
    const nextOrder = editingStep ? editingStep.stepOrder : steps.length + 1;

    if (editingStep) {
      updateStepMutation.mutate({
        id: editingStep.id,
        actionType: stepFormData.actionType as any,
        payloadJson: stepFormData.payloadJson,
        timeoutMs: stepFormData.timeoutMs,
        onErrorAction: stepFormData.onErrorAction as any,
      });
    } else {
      addStepMutation.mutate({
        routeId: selectedRoute.id,
        stepOrder: nextOrder,
        actionType: stepFormData.actionType as any,
        payloadJson: stepFormData.payloadJson,
        timeoutMs: stepFormData.timeoutMs,
        onErrorAction: stepFormData.onErrorAction as any,
      });
    }
  };

  const handleDeleteStep = (step: any) => {
    if (confirm(`Удалить шаг "${ACTION_TYPES.find(a => a.value === step.actionType)?.label}"?`)) {
      deleteStepMutation.mutate({ id: step.id });
    }
  };

  const moveStep = (stepId: number, direction: 'up' | 'down') => {
    if (!selectedRoute) return;
    const steps = stepsData?.steps || [];
    const currentIndex = steps.findIndex((s: any) => s.id === stepId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;

    const newOrder = [...steps];
    [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];

    reorderStepsMutation.mutate({
      routeId: selectedRoute.id,
      stepIds: newOrder.map((s: any) => s.id),
    });
  };

  const getActionIcon = (actionType: string) => {
    const action = ACTION_TYPES.find(a => a.value === actionType);
    const Icon = action?.icon || Zap;
    return <Icon className="h-4 w-4" />;
  };

  const getPayloadFields = (actionType: string) => {
    switch (actionType) {
      case "WEIGH":
      case "WEIGH_STABLE":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Режим</Label>
              <Select
                value={stepFormData.payloadJson.mode || "stable"}
                onValueChange={(v) => setStepFormData({
                  ...stepFormData,
                  payloadJson: { ...stepFormData.payloadJson, mode: v }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stable">Стабильный (S)</SelectItem>
                  <SelectItem value="instant">Мгновенный (SI)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Количество попыток</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={stepFormData.payloadJson.retries || 3}
                onChange={(e) => setStepFormData({
                  ...stepFormData,
                  payloadJson: { ...stepFormData.payloadJson, retries: parseInt(e.target.value) || 3 }
                })}
              />
            </div>
          </div>
        );
      case "DISPLAY":
        return (
          <div className="space-y-2">
            <Label>Текст для дисплея</Label>
            <Input
              value={stepFormData.payloadJson.text || ""}
              onChange={(e) => setStepFormData({
                ...stepFormData,
                payloadJson: { ...stepFormData.payloadJson, text: e.target.value }
              })}
              placeholder="Например: Взвешивание..."
            />
            <p className="text-xs text-muted-foreground">
              Переменные: {"{weight}"}, {"{sku}"}, {"{productName}"}
            </p>
          </div>
        );
      case "PRINT":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Принтер</Label>
              <Select
                value={stepFormData.payloadJson.printerId?.toString() || "auto"}
                onValueChange={(v) => setStepFormData({
                  ...stepFormData,
                  payloadJson: { ...stepFormData.payloadJson, printerId: v === "auto" ? null : parseInt(v) }
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите принтер" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Автоматически</SelectItem>
                  {printers.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Шаблон этикетки</Label>
              <Textarea
                value={stepFormData.payloadJson.labelTemplate || ""}
                onChange={(e) => setStepFormData({
                  ...stepFormData,
                  payloadJson: { ...stepFormData.payloadJson, labelTemplate: e.target.value }
                })}
                placeholder="ZPL или текст этикетки"
                rows={4}
              />
            </div>
          </div>
        );
      case "SEND_TO_ONEBOX":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Endpoint</Label>
              <Input
                value={stepFormData.payloadJson.endpoint || "/api/v2/order/set/"}
                onChange={(e) => setStepFormData({
                  ...stepFormData,
                  payloadJson: { ...stepFormData.payloadJson, endpoint: e.target.value }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label>Поле для веса в OneBox</Label>
              <Input
                value={stepFormData.payloadJson.weightField || "weight"}
                onChange={(e) => setStepFormData({
                  ...stepFormData,
                  payloadJson: { ...stepFormData.payloadJson, weightField: e.target.value }
                })}
                placeholder="weight"
              />
            </div>
          </div>
        );
      case "WAIT":
        return (
          <div className="space-y-2">
            <Label>Время ожидания (мс)</Label>
            <Input
              type="number"
              min={100}
              max={60000}
              value={stepFormData.payloadJson.waitMs || 1000}
              onChange={(e) => setStepFormData({
                ...stepFormData,
                payloadJson: { ...stepFormData.payloadJson, waitMs: parseInt(e.target.value) || 1000 }
              })}
            />
          </div>
        );
      case "CUSTOM":
        return (
          <div className="space-y-2">
            <Label>SICS команда</Label>
            <Input
              value={stepFormData.payloadJson.command || ""}
              onChange={(e) => setStepFormData({
                ...stepFormData,
                payloadJson: { ...stepFormData.payloadJson, command: e.target.value }
              })}
              placeholder="Например: @"
            />
          </div>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const steps = stepsData?.steps || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('routing.title')}</h1>
          <p className="text-muted-foreground">
            {t('routing.subtitle')}
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            {t('routing.addRoute')}
          </Button>
        )}
      </div>

      {/* Routes List */}
      {routes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Нет настроенных маршрутов.<br />
              Создайте первый маршрут для автоматизации взвешивания.
            </p>
            {canEdit && (
              <Button className="mt-4" onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Создать маршрут
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {routes.map((route: any) => (
            <Card key={route.id} className={!route.isActive ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GitBranch className="h-5 w-5" />
                    {route.name}
                    {route.isDefault && (
                      <Badge variant="secondary" className="ml-2">По умолчанию</Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={route.isActive ? "default" : "secondary"}>
                      {route.isActive ? t('common.enabled') : t('common.disabled')}
                    </Badge>
                  </div>
                </div>
                {route.description && (
                  <CardDescription>{route.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <ListOrdered className="h-4 w-4" />
                  <span>Шагов: {route.stepsCount || 0}</span>
                  <span className="mx-2">•</span>
                  <span>Создан: {new Date(route.createdAt).toLocaleDateString()}</span>
                </div>

                {canEdit && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openStepsDialog(route)}
                    >
                      <PlayCircle className="h-3 w-3 mr-1" />
                      Шаги
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(route)}
                    >
                      <Settings className="h-3 w-3 mr-1" />
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(route)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      {t('common.delete')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Route Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRoute ? "Редактировать маршрут" : "Добавить маршрут"}
            </DialogTitle>
            <DialogDescription>
              {editingRoute ? "Измените параметры маршрута" : "Создайте новый маршрут взвешивания"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Например: Стандартное взвешивание"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Опишите назначение маршрута"
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Активен</Label>
                <p className="text-sm text-muted-foreground">Маршрут доступен для использования</p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>По умолчанию</Label>
                <p className="text-sm text-muted-foreground">Использовать для новых задач</p>
              </div>
              <Switch
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingRoute ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Steps Dialog */}
      <Dialog open={isStepsDialogOpen} onOpenChange={setIsStepsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5" />
              Шаги маршрута: {selectedRoute?.name}
            </DialogTitle>
            <DialogDescription>
              Настройте последовательность действий для этого маршрута
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {stepsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : steps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                <ListOrdered className="h-12 w-12 mb-4" />
                <p>Нет шагов в маршруте</p>
                <p className="text-sm mt-1">Добавьте первый шаг для начала</p>
              </div>
            ) : (
              <div className="space-y-2">
                {steps.map((step: any, index: number) => {
                  const actionType = ACTION_TYPES.find(a => a.value === step.actionType);
                  return (
                    <div
                      key={step.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveStep(step.id, 'up')}
                          disabled={index === 0 || reorderStepsMutation.isPending}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => moveStep(step.id, 'down')}
                          disabled={index === steps.length - 1 || reorderStepsMutation.isPending}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium">
                        {index + 1}
                      </div>
                      
                      <div className="flex items-center gap-2 flex-1">
                        {getActionIcon(step.actionType)}
                        <div>
                          <p className="font-medium">{actionType?.label || step.actionType}</p>
                          <p className="text-xs text-muted-foreground">
                            Таймаут: {step.timeoutMs}мс • При ошибке: {ERROR_ACTIONS.find(e => e.value === step.onErrorAction)?.label}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditStepDialog(step)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteStep(step)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {canEdit && (
              <Button
                variant="outline"
                className="w-full"
                onClick={openAddStepDialog}
              >
                <Plus className="h-4 w-4 mr-2" />
                Добавить шаг
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStepsDialogOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Step Dialog */}
      <Dialog open={isAddStepDialogOpen} onOpenChange={setIsAddStepDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingStep ? "Редактировать шаг" : "Добавить шаг"}
            </DialogTitle>
            <DialogDescription>
              Настройте параметры действия
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Тип действия</Label>
              <Select
                value={stepFormData.actionType}
                onValueChange={(v) => setStepFormData({ ...stepFormData, actionType: v, payloadJson: {} })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map((action) => (
                    <SelectItem key={action.value} value={action.value}>
                      <div className="flex items-center gap-2">
                        <action.icon className="h-4 w-4" />
                        {action.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ACTION_TYPES.find(a => a.value === stepFormData.actionType)?.description}
              </p>
            </div>

            {/* Action-specific fields */}
            {getPayloadFields(stepFormData.actionType)}

            <div className="space-y-2">
              <Label>Таймаут (мс)</Label>
              <Input
                type="number"
                min={100}
                max={300000}
                value={stepFormData.timeoutMs}
                onChange={(e) => setStepFormData({ ...stepFormData, timeoutMs: parseInt(e.target.value) || 5000 })}
              />
            </div>

            <div className="space-y-2">
              <Label>При ошибке</Label>
              <Select
                value={stepFormData.onErrorAction}
                onValueChange={(v) => setStepFormData({ ...stepFormData, onErrorAction: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ERROR_ACTIONS.map((action) => (
                    <SelectItem key={action.value} value={action.value}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeStepDialog}>
              Отмена
            </Button>
            <Button
              onClick={handleStepSubmit}
              disabled={addStepMutation.isPending || updateStepMutation.isPending}
            >
              {(addStepMutation.isPending || updateStepMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingStep ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
