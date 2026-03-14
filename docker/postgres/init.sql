-- Inicialización de PostgreSQL con TimescaleDB
-- Este script se ejecuta automáticamente al crear el contenedor

-- Activar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- Para búsqueda fuzzy por nombre

-- Configuración de timezone
ALTER DATABASE trainr_dev SET timezone TO 'UTC';
