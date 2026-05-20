-- Sprint 9 ext — users.branch_id (kullanıcı-şube ataması)
--
-- SUBE_MUDURU rolü için zorunlu (1 şube = 1 müdür constraint backend'de
-- inviteUser helper'da uygulanır). STAFF için opsiyonel. BAYI_SAHIBI ve
-- SUPERADMIN için null (tenant geneli).
--
-- FK: ON DELETE SET NULL — şube silinince kullanıcı kalır, branchId null.

ALTER TABLE "petstockpro"."users"
  ADD COLUMN IF NOT EXISTS "branch_id" uuid;
--> statement-breakpoint

ALTER TABLE "petstockpro"."users"
  ADD CONSTRAINT "users_branch_id_branches_id_fk"
  FOREIGN KEY ("branch_id") REFERENCES "petstockpro"."branches"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

-- Partial unique: aynı branch'ta sadece 1 SUBE_MUDURU olabilir
-- (BAYI_SAHIBI/STAFF/diğer rollerde sınırsız)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_one_sube_muduru_per_branch"
  ON "petstockpro"."users" ("branch_id")
  WHERE "role" = 'SUBE_MUDURU' AND "branch_id" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_users_branch"
  ON "petstockpro"."users" ("branch_id")
  WHERE "branch_id" IS NOT NULL;
