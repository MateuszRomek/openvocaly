CREATE TABLE `meeting_segments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`meeting_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`start_ms` integer NOT NULL,
	`end_ms` integer NOT NULL,
	`text` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `meeting_segments_meeting_chunk_unique` ON `meeting_segments` (`meeting_id`,`chunk_index`);--> statement-breakpoint
CREATE INDEX `meeting_segments_meeting_id_idx` ON `meeting_segments` (`meeting_id`);--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`source_file_name` text NOT NULL,
	`source_file_path` text NOT NULL,
	`status` text NOT NULL,
	`provider_id` text NOT NULL,
	`model_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`duration_ms` integer,
	`completed_chunks` integer DEFAULT 0 NOT NULL,
	`total_chunks` integer DEFAULT 0 NOT NULL,
	`error_message` text
);
--> statement-breakpoint
CREATE INDEX `meetings_created_at_idx` ON `meetings` (`created_at`);--> statement-breakpoint
CREATE INDEX `meetings_status_idx` ON `meetings` (`status`);