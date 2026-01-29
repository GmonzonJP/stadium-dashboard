-- ============================================================================
-- Tabla PriceActionsJobs: Tracking de jobs asíncronos para Price Actions
-- ============================================================================

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PriceActionsJobs]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[PriceActionsJobs] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [JobType] NVARCHAR(50) NOT NULL DEFAULT 'watchlist', -- 'watchlist', 'simulation', etc.
        [Status] NVARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed', 'cancelled'
        [Progress] INT NOT NULL DEFAULT 0, -- 0-100
        [CurrentStep] NVARCHAR(500) NULL, -- Descripción del paso actual
        [TotalItems] INT NOT NULL DEFAULT 0,
        [ProcessedItems] INT NOT NULL DEFAULT 0,
        [Parameters] NVARCHAR(MAX) NULL, -- JSON con filtros y configuración
        [ResultData] NVARCHAR(MAX) NULL, -- JSON con resultados cuando completa
        [ResultSummary] NVARCHAR(MAX) NULL, -- JSON con resumen de resultados
        [ErrorMessage] NVARCHAR(MAX) NULL,
        [CreatedBy] NVARCHAR(100) NULL,
        [CreatedAt] DATETIME NOT NULL DEFAULT GETDATE(),
        [StartedAt] DATETIME NULL,
        [CompletedAt] DATETIME NULL,
        [CancelledAt] DATETIME NULL
    );

    -- Índices para búsquedas frecuentes
    CREATE INDEX IX_PriceActionsJobs_Status ON [dbo].[PriceActionsJobs] ([Status]);
    CREATE INDEX IX_PriceActionsJobs_JobType ON [dbo].[PriceActionsJobs] ([JobType]);
    CREATE INDEX IX_PriceActionsJobs_CreatedAt ON [dbo].[PriceActionsJobs] ([CreatedAt] DESC);
    CREATE INDEX IX_PriceActionsJobs_CreatedBy ON [dbo].[PriceActionsJobs] ([CreatedBy]);

    PRINT 'Tabla PriceActionsJobs creada exitosamente';
END
ELSE
BEGIN
    PRINT 'Tabla PriceActionsJobs ya existe';
END;

-- ============================================================================
-- Procedimiento para actualizar progreso de un job
-- ============================================================================

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_UpdateJobProgress]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_UpdateJobProgress];
GO

CREATE PROCEDURE [dbo].[sp_UpdateJobProgress]
    @JobId UNIQUEIDENTIFIER,
    @Progress INT,
    @CurrentStep NVARCHAR(500) = NULL,
    @ProcessedItems INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE [dbo].[PriceActionsJobs]
    SET 
        [Progress] = @Progress,
        [CurrentStep] = ISNULL(@CurrentStep, [CurrentStep]),
        [ProcessedItems] = ISNULL(@ProcessedItems, [ProcessedItems])
    WHERE [Id] = @JobId AND [Status] = 'running';
END;
GO

-- ============================================================================
-- Procedimiento para marcar job como completado
-- ============================================================================

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_CompleteJob]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_CompleteJob];
GO

CREATE PROCEDURE [dbo].[sp_CompleteJob]
    @JobId UNIQUEIDENTIFIER,
    @ResultData NVARCHAR(MAX) = NULL,
    @ResultSummary NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE [dbo].[PriceActionsJobs]
    SET 
        [Status] = 'completed',
        [Progress] = 100,
        [CurrentStep] = 'Completado',
        [ResultData] = @ResultData,
        [ResultSummary] = @ResultSummary,
        [CompletedAt] = GETDATE()
    WHERE [Id] = @JobId;
END;
GO

-- ============================================================================
-- Procedimiento para marcar job como fallido
-- ============================================================================

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_FailJob]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_FailJob];
GO

CREATE PROCEDURE [dbo].[sp_FailJob]
    @JobId UNIQUEIDENTIFIER,
    @ErrorMessage NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE [dbo].[PriceActionsJobs]
    SET 
        [Status] = 'failed',
        [CurrentStep] = 'Error',
        [ErrorMessage] = @ErrorMessage,
        [CompletedAt] = GETDATE()
    WHERE [Id] = @JobId;
END;
GO

-- ============================================================================
-- Procedimiento para cancelar job
-- ============================================================================

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_CancelJob]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_CancelJob];
GO

CREATE PROCEDURE [dbo].[sp_CancelJob]
    @JobId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE [dbo].[PriceActionsJobs]
    SET 
        [Status] = 'cancelled',
        [CurrentStep] = 'Cancelado por usuario',
        [CancelledAt] = GETDATE()
    WHERE [Id] = @JobId AND [Status] IN ('pending', 'running');
    
    SELECT @@ROWCOUNT as AffectedRows;
END;
GO

-- ============================================================================
-- Limpieza de jobs antiguos (más de 24 horas)
-- ============================================================================

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_CleanupOldJobs]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_CleanupOldJobs];
GO

CREATE PROCEDURE [dbo].[sp_CleanupOldJobs]
    @HoursOld INT = 24
AS
BEGIN
    SET NOCOUNT ON;
    
    DELETE FROM [dbo].[PriceActionsJobs]
    WHERE [CreatedAt] < DATEADD(HOUR, -@HoursOld, GETDATE())
      AND [Status] IN ('completed', 'failed', 'cancelled');
    
    SELECT @@ROWCOUNT as DeletedCount;
END;
GO

PRINT 'Stored procedures para jobs creados exitosamente';
