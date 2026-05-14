CREATE TABLE `bot_modes` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bot_modes_bot_name_idx` ON `bot_modes` (`bot_id`,`name`);--> statement-breakpoint
CREATE TABLE `bots` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bots_name_unique` ON `bots` (`name`);--> statement-breakpoint
CREATE TABLE `combo_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`combo_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`action` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`config_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `combo_versions_combo_idx` ON `combo_versions` (`combo_id`,`version_number`);--> statement-breakpoint
CREATE TABLE `combos` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`config_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_run_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`trading_date` text NOT NULL,
	`trade_count` integer NOT NULL,
	`net_profit` real NOT NULL,
	`cumulative_net_profit` real NOT NULL,
	`win_count` integer NOT NULL,
	`loss_count` integer NOT NULL,
	`max_drawdown` real NOT NULL,
	`best_trade` real NOT NULL,
	`worst_trade` real NOT NULL,
	`avg_mae` real,
	`avg_mfe` real,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_run_metrics_run_date_idx` ON `daily_run_metrics` (`run_id`,`trading_date`);--> statement-breakpoint
CREATE TABLE `golden_baselines` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_id` text NOT NULL,
	`bot_mode_id` text,
	`instrument_id` text NOT NULL,
	`timeframe` text NOT NULL,
	`run_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bot_mode_id`) REFERENCES `bot_modes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `golden_baselines_scope_mode_idx` ON `golden_baselines` (`bot_id`,`bot_mode_id`,`instrument_id`,`timeframe`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_hash` text NOT NULL,
	`raw_csv` text NOT NULL,
	`import_profile` text NOT NULL,
	`mapping_json` text NOT NULL,
	`row_count` integer NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`name` text,
	`yahoo_symbol` text,
	`exchange_timezone` text NOT NULL,
	`session_start_hour` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instruments_symbol_unique` ON `instruments` (`symbol`);--> statement-breakpoint
CREATE TABLE `market_bars` (
	`id` text PRIMARY KEY NOT NULL,
	`instrument_id` text NOT NULL,
	`yahoo_symbol` text NOT NULL,
	`trading_date` text NOT NULL,
	`open` real,
	`high` real,
	`low` real,
	`close` real,
	`volume` real,
	`true_range` real,
	`atr14` real,
	`range` real,
	`gap` real,
	`source_status` text NOT NULL,
	`source_message` text,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_bars_instrument_date_idx` ON `market_bars` (`instrument_id`,`trading_date`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_id` text NOT NULL,
	`bot_mode_id` text,
	`instrument_id` text NOT NULL,
	`name` text NOT NULL,
	`timeframe` text NOT NULL,
	`settings_json` text NOT NULL,
	`tags` text NOT NULL,
	`notes` text NOT NULL,
	`trade_count` integer NOT NULL,
	`first_trade_at` text,
	`last_trade_at` text,
	`net_profit` real NOT NULL,
	`max_drawdown` real NOT NULL,
	`win_rate` real NOT NULL,
	`profit_factor` real,
	`expectancy` real NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bot_mode_id`) REFERENCES `bot_modes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `runs_bot_instrument_idx` ON `runs` (`bot_id`,`instrument_id`);--> statement-breakpoint
CREATE TABLE `trade_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`trade_number` integer NOT NULL,
	`close_time_raw` text NOT NULL,
	`close_time_utc` text NOT NULL,
	`trading_date` text NOT NULL,
	`cumulative_net_profit` real NOT NULL,
	`net_profit` real NOT NULL,
	`commission` real NOT NULL,
	`cumulative_max_drawdown` real NOT NULL,
	`max_drawdown` real NOT NULL,
	`mae` real,
	`mfe` real,
	`etd` real,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trade_summaries_run_number_idx` ON `trade_summaries` (`run_id`,`trade_number`);--> statement-breakpoint
CREATE INDEX `trade_summaries_run_date_idx` ON `trade_summaries` (`run_id`,`trading_date`);