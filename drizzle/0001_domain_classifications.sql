CREATE TABLE "domain_classifications" (
	"domain" text NOT NULL,
	"keyword" text NOT NULL,
	"label" text NOT NULL,
	"company_name" text,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domain_classifications_domain_keyword_pk" PRIMARY KEY("domain","keyword")
);
--> statement-breakpoint
CREATE INDEX "domain_classifications_keyword_idx" ON "domain_classifications" USING btree ("keyword");
