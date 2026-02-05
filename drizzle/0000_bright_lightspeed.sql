CREATE TABLE `account_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`date` integer NOT NULL,
	`balance` real NOT NULL,
	`is_manual` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `snapshots_by_account` ON `account_snapshots` (`account_id`);--> statement-breakpoint
CREATE INDEX `snapshots_by_date` ON `account_snapshots` (`date`);--> statement-breakpoint
CREATE INDEX `snapshots_by_account_date` ON `account_snapshots` (`account_id`,`date`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`institution` text NOT NULL,
	`account_number_last4` text,
	`tax_treatment` text NOT NULL,
	`is_retirement` integer NOT NULL,
	`is_active` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `accounts_by_type` ON `accounts` (`type`);--> statement-breakpoint
CREATE INDEX `accounts_by_institution` ON `accounts` (`institution`);--> statement-breakpoint
CREATE TABLE `allocation_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text,
	`asset_class` text NOT NULL,
	`target_percent` real NOT NULL,
	`rebalance_threshold` real NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `allocation_by_asset_class` ON `allocation_targets` (`asset_class`);--> statement-breakpoint
CREATE INDEX `allocation_by_account` ON `allocation_targets` (`account_id`);--> statement-breakpoint
CREATE INDEX `allocation_by_account_asset` ON `allocation_targets` (`account_id`,`asset_class`);--> statement-breakpoint
CREATE TABLE `annual_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`annual_amount` real NOT NULL,
	`start_year` integer,
	`end_year` integer,
	`notes` text,
	`is_essential` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`zillow_id` text,
	`current_value` real NOT NULL,
	`is_auto_updated` integer NOT NULL,
	`last_updated` integer NOT NULL,
	`purchase_price` real,
	`purchase_date` integer,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `assets_by_type` ON `assets` (`type`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`type` text NOT NULL,
	`is_essential` integer NOT NULL,
	`color` text NOT NULL,
	`icon` text,
	`sort_order` integer NOT NULL,
	`is_system` integer NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `categories_by_parent` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE INDEX `categories_by_type` ON `categories` (`type`);--> statement-breakpoint
CREATE INDEX `categories_by_name` ON `categories` (`name`);--> statement-breakpoint
CREATE TABLE `categorization_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`pattern` text NOT NULL,
	`category_id` text NOT NULL,
	`priority` integer NOT NULL,
	`is_active` integer NOT NULL,
	`created_by` text NOT NULL,
	`match_count` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rules_by_priority` ON `categorization_rules` (`priority`);--> statement-breakpoint
CREATE INDEX `rules_by_category` ON `categorization_rules` (`category_id`);--> statement-breakpoint
CREATE INDEX `rules_by_created_by` ON `categorization_rules` (`created_by`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`target_value` real NOT NULL,
	`target_date` integer,
	`is_achieved` integer NOT NULL,
	`achieved_date` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `goals_by_type` ON `goals` (`type`);--> statement-breakpoint
CREATE TABLE `guardrails_config` (
	`id` text PRIMARY KEY NOT NULL,
	`is_enabled` integer NOT NULL,
	`upper_threshold_percent` real NOT NULL,
	`lower_threshold_percent` real NOT NULL,
	`spending_adjustment_percent` real NOT NULL,
	`spending_floor` real,
	`spending_ceiling` real,
	`strategy_type` text NOT NULL,
	`fixed_adjustment_amount` real,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `holdings` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`shares` real NOT NULL,
	`cost_basis` real,
	`asset_class` text NOT NULL,
	`last_price` real,
	`last_price_updated` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `holdings_by_account` ON `holdings` (`account_id`);--> statement-breakpoint
CREATE INDEX `holdings_by_symbol` ON `holdings` (`symbol`);--> statement-breakpoint
CREATE INDEX `holdings_by_asset_class` ON `holdings` (`asset_class`);--> statement-breakpoint
CREATE TABLE `import_history` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`institution` text NOT NULL,
	`account_id` text,
	`transaction_count` integer NOT NULL,
	`duplicates_skipped` integer NOT NULL,
	`imported_at` integer NOT NULL,
	`status` text NOT NULL,
	`errors` text,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `import_history_by_date` ON `import_history` (`imported_at`);--> statement-breakpoint
CREATE TABLE `income_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`annual_amount` real NOT NULL,
	`start_date` integer,
	`end_date` integer,
	`growth_rate` real NOT NULL,
	`is_taxable` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `income_sources_by_type` ON `income_sources` (`type`);--> statement-breakpoint
CREATE TABLE `liabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`current_balance` real NOT NULL,
	`interest_rate` real NOT NULL,
	`minimum_payment` real NOT NULL,
	`original_amount` real,
	`term_months` integer,
	`start_date` integer,
	`extra_payment_monthly` real,
	`payoff_date` integer,
	`linked_account_id` text,
	`scheduled_payments` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`linked_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `liabilities_by_type` ON `liabilities` (`type`);--> statement-breakpoint
CREATE INDEX `liabilities_by_linked_account` ON `liabilities` (`linked_account_id`);--> statement-breakpoint
CREATE TABLE `monte_carlo_assumptions` (
	`id` text PRIMARY KEY NOT NULL,
	`real_return` real NOT NULL,
	`volatility` real NOT NULL,
	`plan_to_age` integer NOT NULL,
	`target_success_rate` real NOT NULL,
	`iterations` integer,
	`part_time_annual_income` real,
	`part_time_years` integer,
	`legacy_target` real,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `monte_carlo_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`inputs_hash` text NOT NULL,
	`results` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monte_carlo_cache_inputs_hash_unique` ON `monte_carlo_cache` (`inputs_hash`);--> statement-breakpoint
CREATE INDEX `monte_carlo_cache_by_hash` ON `monte_carlo_cache` (`inputs_hash`);--> statement-breakpoint
CREATE TABLE `one_time_events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`year` integer NOT NULL,
	`amount` real NOT NULL,
	`category` text,
	`notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_by_year` ON `one_time_events` (`year`);--> statement-breakpoint
CREATE TABLE `price_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`price` real NOT NULL,
	`change` real,
	`change_percent` real,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `price_cache_symbol_unique` ON `price_cache` (`symbol`);--> statement-breakpoint
CREATE INDEX `price_cache_by_symbol` ON `price_cache` (`symbol`);--> statement-breakpoint
CREATE TABLE `retirement_profile` (
	`id` text PRIMARY KEY NOT NULL,
	`retirement_date` integer NOT NULL,
	`current_age` integer NOT NULL,
	`annual_spending` real NOT NULL,
	`is_spending_auto_calculated` integer NOT NULL,
	`monthly_base_living_expense` real,
	`is_base_living_expense_auto_calculated` integer
);
--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_baseline` integer NOT NULL,
	`assumptions` text NOT NULL,
	`events` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settings_key_unique` ON `settings` (`key`);--> statement-breakpoint
CREATE INDEX `settings_by_key` ON `settings` (`key`);--> statement-breakpoint
CREATE TABLE `social_security` (
	`id` text PRIMARY KEY NOT NULL,
	`benefit_at_62` real NOT NULL,
	`benefit_at_67` real NOT NULL,
	`benefit_at_70` real NOT NULL,
	`birth_year` integer NOT NULL,
	`birth_month` integer NOT NULL,
	`cola_rate` real NOT NULL,
	`planned_claiming_age` integer,
	`has_spouse` integer,
	`spouse_benefit_at_67` real,
	`spouse_birth_year` integer,
	`spouse_planned_claiming_age` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`date` integer NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`category_id` text,
	`is_recurring` integer NOT NULL,
	`is_flagged` integer NOT NULL,
	`confidence_score` real,
	`tags` text DEFAULT '[]' NOT NULL,
	`import_batch_id` text,
	`source_file` text,
	`linked_transaction_id` text,
	`is_transfer` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`linked_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transactions_by_account` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `transactions_by_date` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_by_category` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_by_flagged` ON `transactions` (`is_flagged`);--> statement-breakpoint
CREATE INDEX `transactions_by_account_date` ON `transactions` (`account_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_by_import_batch` ON `transactions` (`import_batch_id`);--> statement-breakpoint
CREATE INDEX `transactions_by_linked` ON `transactions` (`linked_transaction_id`);