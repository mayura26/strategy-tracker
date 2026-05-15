CREATE TABLE `market_session_features` (
	`id` text PRIMARY KEY NOT NULL,
	`instrument_id` text NOT NULL,
	`yahoo_symbol` text NOT NULL,
	`trading_date` text NOT NULL,
	`opening_range_5` real,
	`opening_range_5_pct` real,
	`opening_range_10` real,
	`opening_range_10_pct` real,
	`opening_range_15` real,
	`opening_range_15_pct` real,
	`closing_range_15` real,
	`closing_range_15_pct` real,
	`source_status` text NOT NULL,
	`source_message` text,
	`fetched_at` text NOT NULL,
	FOREIGN KEY (`instrument_id`) REFERENCES `instruments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_session_features_instrument_date_idx` ON `market_session_features` (`instrument_id`,`trading_date`);