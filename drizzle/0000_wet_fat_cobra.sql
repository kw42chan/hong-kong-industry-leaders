CREATE TYPE "public"."query_status" AS ENUM('pending', 'posted', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."search_status" AS ENUM('queued', 'running', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" uuid NOT NULL,
	"leaders_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "results_search_id_unique" UNIQUE("search_id")
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_id" uuid NOT NULL,
	"query_text" text NOT NULL,
	"dataforseo_task_id" text,
	"status" "query_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_queries_dataforseo_task_id_unique" UNIQUE("dataforseo_task_id")
);
--> statement-breakpoint
CREATE TABLE "searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"keyword" text NOT NULL,
	"locale" text NOT NULL,
	"status" "search_status" DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "searches_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "serp_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_id" uuid NOT NULL,
	"raw_json" jsonb NOT NULL,
	"parsed_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_queries" ADD CONSTRAINT "search_queries_search_id_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serp_snapshots" ADD CONSTRAINT "serp_snapshots_query_id_search_queries_id_fk" FOREIGN KEY ("query_id") REFERENCES "public"."search_queries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "search_queries_search_id_idx" ON "search_queries" USING btree ("search_id");--> statement-breakpoint
CREATE INDEX "search_queries_status_idx" ON "search_queries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "searches_status_idx" ON "searches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "serp_snapshots_query_id_idx" ON "serp_snapshots" USING btree ("query_id");