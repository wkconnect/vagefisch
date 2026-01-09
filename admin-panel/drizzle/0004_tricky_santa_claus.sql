CREATE TABLE `events_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ts` timestamp NOT NULL DEFAULT (now()),
	`level` enum('DEBUG','INFO','WARN','ERROR') NOT NULL DEFAULT 'INFO',
	`source` enum('QUEUE','SCALE','PRINTER','ONEBOX','API','SYSTEM','AUTH') NOT NULL,
	`entity_type` varchar(32),
	`entity_id` varchar(64),
	`message` text NOT NULL,
	`details_json` json,
	CONSTRAINT `events_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metrics_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ts` timestamp NOT NULL DEFAULT (now()),
	`queue_depth` int DEFAULT 0,
	`tasks_new` int DEFAULT 0,
	`tasks_queued` int DEFAULT 0,
	`tasks_running` int DEFAULT 0,
	`tasks_done` int DEFAULT 0,
	`tasks_failed` int DEFAULT 0,
	`tasks_stuck` int DEFAULT 0,
	`success_rate` decimal(5,2),
	`avg_task_duration_ms` int,
	`tasks_last_hour` int DEFAULT 0,
	`errors_last_hour` int DEFAULT 0,
	`online_scales` int DEFAULT 0,
	`total_scales` int DEFAULT 0,
	`online_printers` int DEFAULT 0,
	`total_printers` int DEFAULT 0,
	`last_onebox_sync_at` timestamp,
	`onebox_sync_status` enum('OK','ERROR','DISABLED') DEFAULT 'DISABLED',
	`cpu_percent` decimal(5,2),
	`memory_percent` decimal(5,2),
	`uptime_seconds` bigint,
	CONSTRAINT `metrics_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `route_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`route_id` int NOT NULL,
	`step_order` int NOT NULL,
	`action_type` enum('WEIGH','WEIGH_STABLE','DISPLAY','PRINT','SEND_TO_ONEBOX','WAIT','ZERO','TARE','CUSTOM') NOT NULL,
	`payload_json` json,
	`timeout_ms` int DEFAULT 5000,
	`on_error_action` enum('STOP','SKIP','RETRY') DEFAULT 'STOP',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `route_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `routes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`description` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `routes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weighing_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task_id` varchar(64) NOT NULL,
	`external_ref` varchar(128),
	`status` enum('NEW','QUEUED','RUNNING','DONE','FAILED','STUCK','CANCELLED') NOT NULL DEFAULT 'NEW',
	`scale_id` int,
	`printer_id` int,
	`route_id` int,
	`sku` varchar(128),
	`product_name` varchar(256),
	`batch` varchar(64),
	`tare` decimal(10,3) DEFAULT '0',
	`target_weight` decimal(10,3),
	`min_weight` decimal(10,3),
	`max_weight` decimal(10,3),
	`unit` varchar(8) DEFAULT 'kg',
	`result_weight` decimal(10,3),
	`result_net` decimal(10,3),
	`result_gross` decimal(10,3),
	`is_stable` boolean,
	`raw_message` text,
	`error_message` text,
	`retry_count` int DEFAULT 0,
	`max_retries` int DEFAULT 3,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`queued_at` timestamp,
	`started_at` timestamp,
	`finished_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`onebox_synced` boolean DEFAULT false,
	`onebox_synced_at` timestamp,
	`onebox_response` text,
	CONSTRAINT `weighing_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `weighing_tasks_task_id_unique` UNIQUE(`task_id`)
);
--> statement-breakpoint
ALTER TABLE `local_users` MODIFY COLUMN `username` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `local_users` MODIFY COLUMN `name` varchar(255);--> statement-breakpoint
ALTER TABLE `local_users` MODIFY COLUMN `role` enum('admin','viewer') NOT NULL DEFAULT 'viewer';--> statement-breakpoint
ALTER TABLE `app_settings` ADD `value_type` enum('string','number','boolean','json') DEFAULT 'string';--> statement-breakpoint
ALTER TABLE `app_settings` ADD `category` varchar(64) DEFAULT 'general';--> statement-breakpoint
ALTER TABLE `connector_status` ADD `current_task_id` varchar(64);--> statement-breakpoint
ALTER TABLE `onebox_settings` ADD `workflow_id` varchar(64);--> statement-breakpoint
ALTER TABLE `onebox_settings` ADD `status_field_id` varchar(64);--> statement-breakpoint
ALTER TABLE `onebox_settings` ADD `weight_field_id` varchar(64);--> statement-breakpoint
ALTER TABLE `scales` ADD `read_command` varchar(32) DEFAULT 'SI';--> statement-breakpoint
ALTER TABLE `scales` ADD `stable_command` varchar(32) DEFAULT 'S';--> statement-breakpoint
ALTER TABLE `scales` ADD `zero_command` varchar(32) DEFAULT 'Z';--> statement-breakpoint
ALTER TABLE `scales` ADD `display_command` varchar(32) DEFAULT 'D';--> statement-breakpoint
ALTER TABLE `scales` ADD `last_weight` decimal(10,3);--> statement-breakpoint
ALTER TABLE `scales` ADD `last_unit` varchar(8);--> statement-breakpoint
ALTER TABLE `telegram_settings` ADD `notify_on_error` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `telegram_settings` ADD `notify_on_stuck` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `local_users` DROP COLUMN `email`;--> statement-breakpoint
ALTER TABLE `local_users` DROP COLUMN `is_active`;--> statement-breakpoint
ALTER TABLE `local_users` DROP COLUMN `last_login_at`;