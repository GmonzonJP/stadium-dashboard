-- ============================================================================
-- TABLAS PARA MÓDULO "PRICE ACTIONS"
-- ============================================================================

-- Tabla de configuración de Price Actions
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PriceActionsConfig]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[PriceActionsConfig] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [ConfigKey] NVARCHAR(100) NOT NULL UNIQUE,
        [ConfigValue] NVARCHAR(MAX) NOT NULL,
        [ConfigType] NVARCHAR(50) NOT NULL DEFAULT 'string', -- 'string', 'number', 'json'
        [Description] NVARCHAR(500) NULL,
        [Category] NVARCHAR(50) NULL, -- 'price_band', 'threshold', 'cycle', 'elasticity'
        [CreatedAt] DATETIME NOT NULL DEFAULT GETDATE(),
        [UpdatedAt] DATETIME NOT NULL DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_PriceActionsConfig_Key ON [dbo].[PriceActionsConfig]([ConfigKey]);
    CREATE INDEX IX_PriceActionsConfig_Category ON [dbo].[PriceActionsConfig]([Category]);
    
    -- Configuración por defecto: Bandas de precio globales (UYU)
    INSERT INTO [dbo].[PriceActionsConfig] ([ConfigKey], [ConfigValue], [ConfigType], [Description], [Category])
    VALUES 
        ('price_bands_global', '[{"min":0,"max":1490},{"min":1491,"max":1790},{"min":1791,"max":2090},{"min":2091,"max":2490},{"min":2491,"max":2990},{"min":2991,"max":999999}]', 'json', 'Bandas de precio globales en UYU', 'price_band'),
        ('cycle_days_default', '90', 'number', 'Ciclo de venta por defecto en días', 'cycle'),
        ('early_days_threshold', '10', 'number', 'Días mínimos desde inicio para considerar "early underperformer"', 'threshold'),
        ('indice_ritmo_critico', '0.6', 'number', 'Índice de ritmo crítico (por debajo de este valor)', 'threshold'),
        ('indice_ritmo_bajo', '0.9', 'number', 'Índice de ritmo bajo', 'threshold'),
        ('indice_ritmo_alto', '1.1', 'number', 'Índice de ritmo alto (por encima de este valor)', 'threshold'),
        ('indice_desaceleracion', '0.7', 'number', 'Índice de desaceleración (por debajo de este valor)', 'threshold'),
        ('dias_stock_alerta', '45', 'number', 'Días de stock para alerta de sobrestock', 'threshold'),
        ('ritmo_ventana_dias', '14', 'number', 'Ventana de días para cálculo de ritmo actual (default)', 'threshold'),
        ('elasticity_fallback', '-1.0', 'number', 'Elasticidad por defecto cuando no hay datos suficientes', 'elasticity'),
        ('margen_minimo_aceptable', NULL, 'number', 'Margen mínimo aceptable (opcional, NULL = sin límite)', 'threshold');
    
    PRINT 'Tabla PriceActionsConfig creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla PriceActionsConfig ya existe';
END

-- Tabla de propuestas de cambio de precio
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PriceChangeProposals]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[PriceChangeProposals] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [BaseCol] NVARCHAR(50) NOT NULL,
        [Descripcion] NVARCHAR(500) NULL,
        [PrecioActual] DECIMAL(18,2) NOT NULL,
        [PrecioPropuesto] DECIMAL(18,2) NOT NULL,
        [PrecioAntes] DECIMAL(18,2) NULL, -- Precio "antes" para promociones (puede diferir de PrecioActual)
        [UsarPrecioAntesAhora] BIT NOT NULL DEFAULT 0, -- Flag para modo antes/ahora
        [Motivo] NVARCHAR(100) NOT NULL, -- 'Early', 'Desacelera', 'Sobrestock', 'Sin tracción', 'Otro'
        [Notas] NVARCHAR(MAX) NULL,
        [Estado] NVARCHAR(20) NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'aprobado', 'descartado'
        [SellOutProyectado] DECIMAL(5,2) NULL, -- Porcentaje
        [MargenTotalProyectado] DECIMAL(18,2) NULL,
        [CostoCastigo] DECIMAL(18,2) NULL,
        [ConfianzaElasticidad] NVARCHAR(20) NULL, -- 'alta', 'media', 'baja'
        [UsuarioId] INT NULL, -- FK a Usuarios (opcional)
        [UsuarioNombre] NVARCHAR(100) NULL, -- Nombre del usuario que creó la propuesta
        [CreatedAt] DATETIME NOT NULL DEFAULT GETDATE(),
        [UpdatedAt] DATETIME NOT NULL DEFAULT GETDATE(),
        [AprobadoPor] NVARCHAR(100) NULL,
        [AprobadoAt] DATETIME NULL
    );
    
    CREATE INDEX IX_PriceChangeProposals_BaseCol ON [dbo].[PriceChangeProposals]([BaseCol]);
    CREATE INDEX IX_PriceChangeProposals_Estado ON [dbo].[PriceChangeProposals]([Estado]);
    CREATE INDEX IX_PriceChangeProposals_CreatedAt ON [dbo].[PriceChangeProposals]([CreatedAt]);
    
    PRINT 'Tabla PriceChangeProposals creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla PriceChangeProposals ya existe';
END

-- Tabla de historial de cambios de propuestas (audit trail)
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PriceChangeHistory]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[PriceChangeHistory] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [ProposalId] INT NOT NULL,
        [Campo] NVARCHAR(100) NOT NULL, -- Campo que cambió
        [ValorAnterior] NVARCHAR(MAX) NULL,
        [ValorNuevo] NVARCHAR(MAX) NULL,
        [Usuario] NVARCHAR(100) NOT NULL,
        [Accion] NVARCHAR(50) NOT NULL, -- 'created', 'updated', 'approved', 'rejected', 'deleted'
        [CreatedAt] DATETIME NOT NULL DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_PriceChangeHistory_ProposalId ON [dbo].[PriceChangeHistory]([ProposalId]);
    CREATE INDEX IX_PriceChangeHistory_CreatedAt ON [dbo].[PriceChangeHistory]([CreatedAt]);
    
    PRINT 'Tabla PriceChangeHistory creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla PriceChangeHistory ya existe';
END

-- ============================================================================
-- MIGRACIONES: Agregar columnas nuevas a tablas existentes
-- ============================================================================

-- Agregar columnas para soporte de "Precio Antes/Ahora" si no existen
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[PriceChangeProposals]') AND name = 'PrecioAntes')
BEGIN
    ALTER TABLE [dbo].[PriceChangeProposals] ADD [PrecioAntes] DECIMAL(18,2) NULL;
    PRINT 'Columna PrecioAntes agregada a PriceChangeProposals';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[PriceChangeProposals]') AND name = 'UsarPrecioAntesAhora')
BEGIN
    ALTER TABLE [dbo].[PriceChangeProposals] ADD [UsarPrecioAntesAhora] BIT NOT NULL DEFAULT 0;
    PRINT 'Columna UsarPrecioAntesAhora agregada a PriceChangeProposals';
END

PRINT 'Script de creación de tablas Price Actions completado';
