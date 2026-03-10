ALTER TABLE `sessions` ADD `target_app_name` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `target_app_identifier` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `target_app_path` text;--> statement-breakpoint
CREATE INDEX `sessions_target_app_identifier_idx` ON `sessions` (`target_app_identifier`);