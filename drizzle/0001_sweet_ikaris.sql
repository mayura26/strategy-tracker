CREATE TABLE `analysis_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`ema_fast_period` integer NOT NULL,
	`ema_mid_period` integer NOT NULL,
	`ema_slow_period` integer NOT NULL,
	`rsi_period` integer NOT NULL,
	`updated_at` text NOT NULL
);
