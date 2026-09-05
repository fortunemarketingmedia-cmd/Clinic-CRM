-- Keep the two live clinics available without running the demo seed in production.
INSERT INTO "Branch" ("id", "name", "address", "phone", "createdAt", "updatedAt")
SELECT 'branch_nashik_road', 'Nashik Road', 'Nashik Road, Nashik', '+91-0000000000', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Branch" WHERE "name" = 'Nashik Road');

-- Both production roles can switch between the two clinic branches. Admins already
-- have global access, but explicit rows keep staff selectors and assignments correct.
INSERT INTO "UserBranch" ("userId", "branchId", "isPrimary", "createdAt")
SELECT user_record."id", branch_record."id", false, CURRENT_TIMESTAMP
FROM "User" AS user_record
CROSS JOIN "Branch" AS branch_record
WHERE user_record."status" = 'ACTIVE'
  AND user_record."role" IN ('ADMIN', 'RECEPTIONIST')
  AND branch_record."name" IN ('Sharanpur Road', 'Nashik Road')
ON CONFLICT ("userId", "branchId") DO NOTHING;
