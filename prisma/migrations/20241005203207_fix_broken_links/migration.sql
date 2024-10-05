-- All of the {xyz:} syntax was changed to {xyz;...} in the code, but the migration was not applied to the database.
-- This migration fixes the broken links by updating the syntax to {xyz;...}.
-- See `const instructionRegex = /{(set|webrequest|eval|if|choose|random|followup|require|not);(.*?)}|{if;.*?}[\s\S]*?{endif}/;`

-- Update CustomCommand table to fix broken links
UPDATE "CustomCommand"
SET "response" = REGEXP_REPLACE("response", '{(set|webrequest|eval|if|choose|random|followup|require|not):([^}]*)}', '{\1;\2}', 'g')
WHERE "response" ~ '{(set|webrequest|eval|if|choose|random|followup|require|not):';

-- Update if-endif blocks
UPDATE "CustomCommand"
SET "response" = REGEXP_REPLACE("response", '{if:([^}]*)}([\s\S]*?){endif}', '{if;\1}\2{endif}', 'g')
WHERE "response" ~ '{if:.*?}[\s\S]*?{endif}';