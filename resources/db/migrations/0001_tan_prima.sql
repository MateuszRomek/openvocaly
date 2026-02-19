CREATE TABLE `shortcut_bindings` (
	`action` text PRIMARY KEY NOT NULL,
	`accelerator` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shortcut_bindings_accelerator_unique` ON `shortcut_bindings` (`accelerator`);