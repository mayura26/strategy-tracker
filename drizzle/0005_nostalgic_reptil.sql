CREATE TABLE `saved_switch_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_id` text NOT NULL,
	`instrument_id` text NOT NULL,
	`timeframe` text NOT NULL,
	`mode_a_run_id` text NOT NULL,
	`mode_b_run_id` text NOT NULL,
	`name` text NOT NULL,
	`rule_json` text NOT NULL,
	`metrics_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`bot_id`) REFERENCES `bots`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mode_a_run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mode_b_run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `saved_switch_rules_scope_idx` ON `saved_switch_rules` (`bot_id`,`instrument_id`,`timeframe`);