\set ON_ERROR_STOP on
\getenv odoo_password ODOO_DB_PASSWORD
CREATE ROLE odoo LOGIN CREATEDB PASSWORD :'odoo_password';
