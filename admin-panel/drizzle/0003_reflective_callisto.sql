CREATE TABLE `app_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` text,
	`description` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `app_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `connector_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`status` enum('running','stopped','error','unknown') NOT NULL DEFAULT 'unknown',
	`version` varchar(32),
	`last_heartbeat` timestamp,
	`uptime` varchar(64),
	`error_message` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `connector_status_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`level` enum('debug','info','warning','error','critical') NOT NULL DEFAULT 'info',
	`source` varchar(128) NOT NULL,
	`message` text NOT NULL,
	`entity_type` varchar(64),
	`entity_id` int,
	`meta_json` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `onebox_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`base_url` varchar(512),
	`api_token` varchar(512),
	`timeout_sec` int DEFAULT 30,
	`enabled` boolean NOT NULL DEFAULT false,
	`last_sync_at` timestamp,
	`last_error` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `onebox_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `printers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`ip` varchar(45) NOT NULL,
	`port` int NOT NULL DEFAULT 9100,
	`protocol` enum('ZPL','RAW','IPP','CUSTOM') NOT NULL DEFAULT 'ZPL',
	`enabled` boolean NOT NULL DEFAULT true,
	`status` enum('online','offline','error','unknown') NOT NULL DEFAULT 'unknown',
	`last_seen_at` timestamp,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `printers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `queue_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`task_id` varchar(64) NOT NULL,
	`sku` varchar(128),
	`scale_id` int,
	`printer_id` int,
	`status` enum('pending','running','completed','failed','cancelled','stuck') NOT NULL DEFAULT 'pending',
	`priority` int NOT NULL DEFAULT 0,
	`retries` int NOT NULL DEFAULT 0,
	`max_retries` int NOT NULL DEFAULT 3,
	`error_message` text,
	`input_data` json,
	`output_data` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`started_at` timestamp,
	`finished_at` timestamp,
	CONSTRAINT `queue_tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `queue_tasks_task_id_unique` UNIQUE(`task_id`)
);
--> statement-breakpoint
CREATE TABLE `scales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`ip` varchar(45) NOT NULL,
	`port` int NOT NULL DEFAULT 4001,
	`protocol` enum('SICS','IND','MT-SICS','CUSTOM') NOT NULL DEFAULT 'SICS',
	`enabled` boolean NOT NULL DEFAULT true,
	`status` enum('online','offline','error','unknown') NOT NULL DEFAULT 'unknown',
	`last_seen_at` timestamp,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `telegram_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bot_token` varchar(256),
	`chat_id` varchar(64),
	`enabled` boolean NOT NULL DEFAULT false,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `telegram_settings_id` PRIMARY KEY(`id`)
);
