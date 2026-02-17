CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` integer NOT NULL,
	`duration_ms` integer,
	`title` text,
	`source` text
);
--> statement-breakpoint
CREATE INDEX `sessions_started_at_idx` ON `sessions` (`started_at`);--> statement-breakpoint
CREATE TABLE `transcripts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`text` text NOT NULL,
	`language` text,
	`confidence` real,
	`duration_ms` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transcripts_session_id_idx` ON `transcripts` (`session_id`);--> statement-breakpoint
CREATE INDEX `transcripts_created_at_idx` ON `transcripts` (`created_at`);