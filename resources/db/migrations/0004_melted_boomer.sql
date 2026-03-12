CREATE TABLE `session_metrics` (
	`session_id` integer PRIMARY KEY NOT NULL,
	`word_count` integer NOT NULL,
	`wpm` real,
	`duration_ms_effective` integer NOT NULL,
	`computed_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `session_metrics_computed_at_idx` ON `session_metrics` (`computed_at`);