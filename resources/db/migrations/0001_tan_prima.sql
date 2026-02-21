CREATE TABLE `shortcut_bindings` (
	`action` text PRIMARY KEY NOT NULL,
	`accelerator` text NOT NULL,
	`key` text NOT NULL,
	`mod_cmd` integer NOT NULL,
	`mod_ctrl` integer NOT NULL,
	`mod_alt` integer NOT NULL,
	`mod_shift` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shortcut_bindings_accelerator_unique` ON `shortcut_bindings` (`accelerator`);
--> statement-breakpoint
CREATE UNIQUE INDEX `shortcut_bindings_key_modifiers_unique` ON `shortcut_bindings` (`key`,`mod_cmd`,`mod_ctrl`,`mod_alt`,`mod_shift`);
