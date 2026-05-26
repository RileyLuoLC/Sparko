ALTER TABLE "XAccount" ADD COLUMN "roleLabels" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "XAccount"
SET "roleLabels" = ARRAY["Persona"."roleLabel"]
FROM "Persona"
WHERE "XAccount"."personaId" = "Persona"."id"
  AND "Persona"."roleLabel" <> ''
  AND "Persona"."roleLabel" <> 'Needs setup'
  AND "Persona"."roleLabel" <> 'Operator';

