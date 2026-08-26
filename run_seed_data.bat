@echo off
set PGPASSWORD=motohub_secret
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U motohub -h 127.0.0.1 -p 5432 -F p --data-only --column-inserts --no-owner --no-acl -t settings -t brands -t motorcycle_models -t categories -t products -t inventories motohub > "C:\Users\PC\Desktop\motoERP\seed_data.sql"
echo EXITCODE=%ERRORLEVEL%
