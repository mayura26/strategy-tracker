CREATE TABLE `analysis_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_type` text NOT NULL,
	`status` text NOT NULL,
	`input_json` text NOT NULL,
	`result_json` text,
	`error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `analysis_jobs_status_idx` ON `analysis_jobs` (`status`,`created_at`);