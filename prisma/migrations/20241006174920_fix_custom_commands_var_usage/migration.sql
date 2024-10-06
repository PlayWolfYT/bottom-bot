-- The syntax {var;name} was changed to just {name}, all the other statements are unchanged (e.g. {set;name;value})

UPDATE "CustomCommand"
SET "response" = REGEXP_REPLACE("response", '{var;([^}]*)}', '{1}', 'g')
WHERE "response" ~ '{var;';
