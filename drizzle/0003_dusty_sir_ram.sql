ALTER TABLE `analysis_settings` ADD `atr_period` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `analysis_settings` ADD `ema_cross_lookback_days` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `analysis_settings` ADD `rsi_lower_band` integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `analysis_settings` ADD `rsi_upper_band` integer DEFAULT 70 NOT NULL;