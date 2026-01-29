-- ============================================================================
-- Stored Procedure: sp_GetPriceActionsWatchlist
-- Calcula todos los datos de watchlist de forma optimizada en SQL
-- ============================================================================

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_GetPriceActionsWatchlist]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_GetPriceActionsWatchlist];
GO

CREATE PROCEDURE [dbo].[sp_GetPriceActionsWatchlist]
    @FechaDesde DATE = NULL,
    @FechaHasta DATE = NULL,
    @RitmoVentanaDias INT = 14,
    @CycleDays INT = 90,
    @IdMarcas NVARCHAR(MAX) = NULL,      -- Comma-separated list
    @IdCategorias NVARCHAR(MAX) = NULL,  -- Comma-separated list
    @IdGeneros NVARCHAR(MAX) = NULL,     -- Comma-separated list
    @IdTiendas NVARCHAR(MAX) = NULL,     -- Comma-separated list
    @SearchTerm NVARCHAR(200) = NULL,
    @ThresholdEarlyDays INT = 10,
    @ThresholdIndiceRitmoCritico DECIMAL(5,2) = 0.6,
    @ThresholdIndiceRitmoBajo DECIMAL(5,2) = 0.9,
    @ThresholdIndiceDesaceleracion DECIMAL(5,2) = 0.7,
    @ThresholdDiasStockAlerta INT = 45
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Defaults para fechas
    IF @FechaHasta IS NULL SET @FechaHasta = CAST(GETDATE() AS DATE);
    IF @FechaDesde IS NULL SET @FechaDesde = DATEADD(DAY, -@RitmoVentanaDias, @FechaHasta);
    
    -- Calcular fecha inicio del ciclo (para ritmo base)
    DECLARE @FechaInicioCiclo DATE = DATEADD(DAY, -@CycleDays, @FechaHasta);
    
    -- Tabla temporal para filtros parseados
    DECLARE @MarcasTable TABLE (Id INT);
    DECLARE @CategoriasTable TABLE (Id INT);
    DECLARE @GenerosTable TABLE (Id INT);
    DECLARE @TiendasTable TABLE (Id INT);
    
    -- Parsear listas comma-separated a tablas
    IF @IdMarcas IS NOT NULL AND LEN(@IdMarcas) > 0
        INSERT INTO @MarcasTable SELECT value FROM STRING_SPLIT(@IdMarcas, ',') WHERE TRY_CAST(value AS INT) IS NOT NULL;
    
    IF @IdCategorias IS NOT NULL AND LEN(@IdCategorias) > 0
        INSERT INTO @CategoriasTable SELECT value FROM STRING_SPLIT(@IdCategorias, ',') WHERE TRY_CAST(value AS INT) IS NOT NULL;
    
    IF @IdGeneros IS NOT NULL AND LEN(@IdGeneros) > 0
        INSERT INTO @GenerosTable SELECT value FROM STRING_SPLIT(@IdGeneros, ',') WHERE TRY_CAST(value AS INT) IS NOT NULL;
    
    IF @IdTiendas IS NOT NULL AND LEN(@IdTiendas) > 0
        INSERT INTO @TiendasTable SELECT value FROM STRING_SPLIT(@IdTiendas, ',') WHERE TRY_CAST(value AS INT) IS NOT NULL;
    
    -- CTE principal con todos los cálculos
    ;WITH 
    -- Ventas en período reciente (para ritmo actual)
    VentasRecientes AS (
        SELECT 
            T.BaseCol,
            SUM(T.Cantidad) as UnidadesRecientes,
            MIN(T.Fecha) as PrimeraVentaReciente,
            MAX(T.Fecha) as UltimaVentaReciente,
            COUNT(DISTINCT T.Fecha) as DiasConVenta
        FROM Transacciones T
        WHERE T.Fecha BETWEEN @FechaDesde AND @FechaHasta
          AND T.Cantidad > 0
          AND (NOT EXISTS(SELECT 1 FROM @MarcasTable) OR T.IdMarca IN (SELECT Id FROM @MarcasTable))
          AND (NOT EXISTS(SELECT 1 FROM @CategoriasTable) OR T.IdClase IN (SELECT Id FROM @CategoriasTable))
          AND (NOT EXISTS(SELECT 1 FROM @GenerosTable) OR T.idGenero IN (SELECT Id FROM @GenerosTable))
          AND (NOT EXISTS(SELECT 1 FROM @TiendasTable) OR T.IdDeposito IN (SELECT Id FROM @TiendasTable))
        GROUP BY T.BaseCol
    ),
    -- Ventas desde inicio de ciclo (para ritmo base)
    VentasCiclo AS (
        SELECT 
            T.BaseCol,
            SUM(T.Cantidad) as UnidadesCiclo,
            MIN(T.Fecha) as PrimeraVentaCiclo,
            MAX(T.Fecha) as UltimaVentaCiclo,
            DATEDIFF(DAY, MIN(T.Fecha), @FechaHasta) + 1 as DiasDesdeInicio
        FROM Transacciones T
        WHERE T.Fecha BETWEEN @FechaInicioCiclo AND @FechaHasta
          AND T.Cantidad > 0
          AND (NOT EXISTS(SELECT 1 FROM @MarcasTable) OR T.IdMarca IN (SELECT Id FROM @MarcasTable))
          AND (NOT EXISTS(SELECT 1 FROM @CategoriasTable) OR T.IdClase IN (SELECT Id FROM @CategoriasTable))
          AND (NOT EXISTS(SELECT 1 FROM @GenerosTable) OR T.idGenero IN (SELECT Id FROM @GenerosTable))
          AND (NOT EXISTS(SELECT 1 FROM @TiendasTable) OR T.IdDeposito IN (SELECT Id FROM @TiendasTable))
        GROUP BY T.BaseCol
    ),
    -- Ventas últimos 7/14/28 días
    VentasPorPeriodo AS (
        SELECT 
            T.BaseCol,
            SUM(CASE WHEN T.Fecha >= DATEADD(DAY, -7, @FechaHasta) THEN T.Cantidad ELSE 0 END) as Unidades7,
            SUM(CASE WHEN T.Fecha >= DATEADD(DAY, -14, @FechaHasta) THEN T.Cantidad ELSE 0 END) as Unidades14,
            SUM(CASE WHEN T.Fecha >= DATEADD(DAY, -28, @FechaHasta) THEN T.Cantidad ELSE 0 END) as Unidades28
        FROM Transacciones T
        WHERE T.Fecha >= DATEADD(DAY, -28, @FechaHasta) AND T.Fecha <= @FechaHasta
          AND T.Cantidad > 0
          AND (NOT EXISTS(SELECT 1 FROM @MarcasTable) OR T.IdMarca IN (SELECT Id FROM @MarcasTable))
          AND (NOT EXISTS(SELECT 1 FROM @CategoriasTable) OR T.IdClase IN (SELECT Id FROM @CategoriasTable))
          AND (NOT EXISTS(SELECT 1 FROM @GenerosTable) OR T.idGenero IN (SELECT Id FROM @GenerosTable))
          AND (NOT EXISTS(SELECT 1 FROM @TiendasTable) OR T.IdDeposito IN (SELECT Id FROM @TiendasTable))
        GROUP BY T.BaseCol
    ),
    -- Stock actual
    StockActual AS (
        SELECT 
            A.Base as BaseCol,
            SUM(MS.TotalStock) as StockOnHand,
            SUM(CASE WHEN MS.Pendientes > 0 THEN MS.Pendientes ELSE 0 END) as StockPendiente,
            SUM(MS.TotalStock) + SUM(CASE WHEN MS.Pendientes > 0 THEN MS.Pendientes ELSE 0 END) as StockTotal
        FROM MovStockTotalResumen MS
        INNER JOIN Articulos A ON A.IdArticulo = MS.IdArticulo
        WHERE (MS.TotalStock > 0 OR ISNULL(MS.Pendientes, 0) > 0)
          AND (NOT EXISTS(SELECT 1 FROM @MarcasTable) OR A.IdMarca IN (SELECT Id FROM @MarcasTable))
          AND (NOT EXISTS(SELECT 1 FROM @CategoriasTable) OR A.IdClase IN (SELECT Id FROM @CategoriasTable))
          AND (NOT EXISTS(SELECT 1 FROM @GenerosTable) OR A.IdGenero IN (SELECT Id FROM @GenerosTable))
        GROUP BY A.Base
    ),
    -- Información de productos
    ProductosInfo AS (
        SELECT DISTINCT
            T.BaseCol,
            MAX(T.DescripcionArticulo) as Descripcion,
            MAX(AR.DescripcionCorta) as DescripcionCorta,
            MAX(T.IdClase) as IdClase,
            MAX(T.DescripcionClase) as DescripcionClase,
            MAX(T.IdMarca) as IdMarca,
            MAX(T.DescripcionMarca) as DescripcionMarca,
            MAX(T.idGenero) as IdGenero,
            MAX(T.DescripcionGenero) as DescripcionGenero,
            COALESCE(MAX(AP.Precio), MAX(T.Precio / NULLIF(T.Cantidad, 0))) as PrecioActual,
            MAX(UC.UltimoCosto) * 1.22 as Costo
        FROM Transacciones T
        LEFT JOIN (
            SELECT Base, MAX(DescripcionCorta) as DescripcionCorta
            FROM Articulos GROUP BY Base
        ) AR ON AR.Base = T.BaseCol
        LEFT JOIN (
            SELECT baseCol, MAX(Precio) as Precio FROM ArticuloPrecio GROUP BY baseCol
        ) AP ON AP.baseCol = T.BaseCol
        LEFT JOIN (
            SELECT A.Base as BaseCol, MAX(UC.UltimoCosto) as UltimoCosto
            FROM UltimaCompra UC
            INNER JOIN Articulos A ON A.IdArticulo = UC.BaseArticulo
            WHERE UC.UltimoCosto IS NOT NULL AND UC.UltimoCosto > 0
            GROUP BY A.Base
        ) UC ON UC.BaseCol = T.BaseCol
        WHERE T.Fecha >= @FechaInicioCiclo
          AND (NOT EXISTS(SELECT 1 FROM @MarcasTable) OR T.IdMarca IN (SELECT Id FROM @MarcasTable))
          AND (NOT EXISTS(SELECT 1 FROM @CategoriasTable) OR T.IdClase IN (SELECT Id FROM @CategoriasTable))
          AND (NOT EXISTS(SELECT 1 FROM @GenerosTable) OR T.idGenero IN (SELECT Id FROM @GenerosTable))
          AND (@SearchTerm IS NULL OR T.BaseCol LIKE '%' + @SearchTerm + '%' 
               OR T.DescripcionArticulo LIKE '%' + @SearchTerm + '%'
               OR AR.DescripcionCorta LIKE '%' + @SearchTerm + '%')
        GROUP BY T.BaseCol
    ),
    -- Calcular ritmo del cluster (promedio de productos similares)
    ClusterRitmo AS (
        SELECT 
            PI.IdClase,
            PI.IdGenero,
            PI.IdMarca,
            -- Banda de precio simplificada (cada 500)
            CAST(FLOOR(ISNULL(PI.PrecioActual, 0) / 500) * 500 AS INT) as PrecioBand,
            AVG(CAST(ISNULL(VR.UnidadesRecientes, 0) AS FLOAT) / @RitmoVentanaDias) as RitmoClusterPromedio,
            COUNT(*) as ProductosEnCluster
        FROM ProductosInfo PI
        LEFT JOIN VentasRecientes VR ON VR.BaseCol = PI.BaseCol
        GROUP BY PI.IdClase, PI.IdGenero, PI.IdMarca, CAST(FLOOR(ISNULL(PI.PrecioActual, 0) / 500) * 500 AS INT)
        HAVING COUNT(*) > 0
    ),
    -- Unir todo y calcular métricas
    WatchlistBase AS (
        SELECT 
            PI.BaseCol,
            PI.Descripcion,
            PI.DescripcionCorta,
            PI.IdClase,
            PI.DescripcionClase,
            PI.IdMarca,
            PI.DescripcionMarca,
            PI.IdGenero,
            PI.DescripcionGenero,
            PI.PrecioActual,
            PI.Costo,
            ISNULL(SA.StockOnHand, 0) as StockOnHand,
            ISNULL(SA.StockPendiente, 0) as StockPendiente,
            ISNULL(SA.StockTotal, 0) as StockTotal,
            ISNULL(VP.Unidades7, 0) as Unidades7,
            ISNULL(VP.Unidades14, 0) as Unidades14,
            ISNULL(VP.Unidades28, 0) as Unidades28,
            ISNULL(VR.UnidadesRecientes, 0) as UnidadesRecientes,
            ISNULL(VC.UnidadesCiclo, 0) as UnidadesCiclo,
            ISNULL(VC.DiasDesdeInicio, 1) as DiasDesdeInicio,
            -- Ritmo actual (unidades/día en ventana reciente)
            CAST(ISNULL(VR.UnidadesRecientes, 0) AS FLOAT) / @RitmoVentanaDias as RitmoActual,
            -- Ritmo base (unidades/día desde inicio)
            CASE WHEN ISNULL(VC.DiasDesdeInicio, 0) > 0 
                 THEN CAST(ISNULL(VC.UnidadesCiclo, 0) AS FLOAT) / VC.DiasDesdeInicio 
                 ELSE 0 END as RitmoBase,
            -- Ritmo del cluster
            ISNULL(CR.RitmoClusterPromedio, 0.1) as RitmoCluster,
            CR.ProductosEnCluster,
            -- Price band para display
            CASE 
                WHEN PI.PrecioActual <= 1490 THEN '0-1490'
                WHEN PI.PrecioActual <= 1790 THEN '1491-1790'
                WHEN PI.PrecioActual <= 2090 THEN '1791-2090'
                WHEN PI.PrecioActual <= 2490 THEN '2091-2490'
                WHEN PI.PrecioActual <= 2990 THEN '2491-2990'
                ELSE '2991+'
            END as PriceBand
        FROM ProductosInfo PI
        LEFT JOIN VentasRecientes VR ON VR.BaseCol = PI.BaseCol
        LEFT JOIN VentasCiclo VC ON VC.BaseCol = PI.BaseCol
        LEFT JOIN VentasPorPeriodo VP ON VP.BaseCol = PI.BaseCol
        LEFT JOIN StockActual SA ON SA.BaseCol = PI.BaseCol
        LEFT JOIN ClusterRitmo CR ON CR.IdClase = PI.IdClase 
                                  AND CR.IdGenero = PI.IdGenero 
                                  AND CR.IdMarca = PI.IdMarca
                                  AND CR.PrecioBand = CAST(FLOOR(ISNULL(PI.PrecioActual, 0) / 500) * 500 AS INT)
        WHERE ISNULL(SA.StockTotal, 0) > 0  -- Solo productos con stock
    )
    -- Resultado final con cálculos de índices y motivos
    SELECT 
        WB.BaseCol,
        WB.Descripcion,
        WB.DescripcionCorta,
        WB.IdClase,
        WB.DescripcionClase as Categoria,
        WB.IdMarca,
        WB.DescripcionMarca as Marca,
        WB.IdGenero,
        WB.DescripcionGenero as Genero,
        WB.PrecioActual,
        WB.Costo,
        WB.StockOnHand,
        WB.StockPendiente,
        WB.StockTotal,
        WB.Unidades7,
        WB.Unidades14,
        WB.Unidades28,
        WB.DiasDesdeInicio,
        WB.RitmoActual,
        WB.RitmoBase,
        WB.RitmoCluster,
        WB.PriceBand,
        -- Índice de desaceleración
        CASE WHEN WB.RitmoBase > 0 THEN WB.RitmoActual / WB.RitmoBase ELSE 1.0 END as IndiceDesaceleracion,
        -- Índice de ritmo vs cluster
        CASE WHEN WB.RitmoCluster > 0 THEN WB.RitmoActual / WB.RitmoCluster ELSE 1.0 END as IndiceRitmo,
        -- Días de stock
        CASE WHEN WB.RitmoActual > 0 THEN WB.StockTotal / WB.RitmoActual ELSE NULL END as DiasStock,
        -- Días restantes del ciclo
        GREATEST(0, @CycleDays - WB.DiasDesdeInicio) as DiasRestantesCiclo,
        -- Determinar motivos (flags)
        CASE WHEN WB.DiasDesdeInicio >= @ThresholdEarlyDays 
              AND (CASE WHEN WB.RitmoCluster > 0 THEN WB.RitmoActual / WB.RitmoCluster ELSE 1.0 END) < 0.7
             THEN 1 ELSE 0 END as MotivoEarly,
        CASE WHEN (CASE WHEN WB.RitmoBase > 0 THEN WB.RitmoActual / WB.RitmoBase ELSE 1.0 END) < @ThresholdIndiceDesaceleracion
              AND WB.StockTotal > 0
              AND ((CASE WHEN WB.RitmoActual > 0 THEN WB.StockTotal / WB.RitmoActual ELSE 9999 END) > @ThresholdDiasStockAlerta
                   OR (CASE WHEN WB.RitmoCluster > 0 THEN WB.RitmoActual / WB.RitmoCluster ELSE 1.0 END) < 0.8)
             THEN 1 ELSE 0 END as MotivoDesacelera,
        CASE WHEN WB.RitmoActual > 0 
              AND (WB.StockTotal / WB.RitmoActual) > GREATEST(0, @CycleDays - WB.DiasDesdeInicio)
             THEN 1 ELSE 0 END as MotivoSobrestock,
        CASE WHEN WB.Unidades14 = 0 AND WB.StockTotal > 0 
             THEN 1 ELSE 0 END as MotivoSinTraccion,
        -- Score (0-100) basado en severidad
        CAST(
            -- Componente índice ritmo (40 puntos max)
            CASE 
                WHEN (CASE WHEN WB.RitmoCluster > 0 THEN WB.RitmoActual / WB.RitmoCluster ELSE 1.0 END) < 0.5 THEN 40
                WHEN (CASE WHEN WB.RitmoCluster > 0 THEN WB.RitmoActual / WB.RitmoCluster ELSE 1.0 END) < 0.7 THEN 30
                WHEN (CASE WHEN WB.RitmoCluster > 0 THEN WB.RitmoActual / WB.RitmoCluster ELSE 1.0 END) < 0.9 THEN 15
                ELSE 0
            END +
            -- Componente días stock vs ciclo restante (30 puntos max)
            CASE 
                WHEN WB.RitmoActual > 0 AND (WB.StockTotal / WB.RitmoActual) > 2 * GREATEST(1, @CycleDays - WB.DiasDesdeInicio) THEN 30
                WHEN WB.RitmoActual > 0 AND (WB.StockTotal / WB.RitmoActual) > 1.5 * GREATEST(1, @CycleDays - WB.DiasDesdeInicio) THEN 20
                WHEN WB.RitmoActual > 0 AND (WB.StockTotal / WB.RitmoActual) > GREATEST(1, @CycleDays - WB.DiasDesdeInicio) THEN 10
                ELSE 0
            END +
            -- Componente desaceleración (20 puntos max)
            CASE 
                WHEN (CASE WHEN WB.RitmoBase > 0 THEN WB.RitmoActual / WB.RitmoBase ELSE 1.0 END) < 0.5 THEN 20
                WHEN (CASE WHEN WB.RitmoBase > 0 THEN WB.RitmoActual / WB.RitmoBase ELSE 1.0 END) < 0.7 THEN 15
                WHEN (CASE WHEN WB.RitmoBase > 0 THEN WB.RitmoActual / WB.RitmoBase ELSE 1.0 END) < 0.9 THEN 5
                ELSE 0
            END +
            -- Componente sin tracción (10 puntos)
            CASE WHEN WB.Unidades14 = 0 AND WB.StockTotal > 0 THEN 10 ELSE 0 END
        AS INT) as Score
    FROM WatchlistBase WB
    WHERE 
        -- Incluir solo si tiene al menos un motivo
        (
            -- Early failure
            (WB.DiasDesdeInicio >= @ThresholdEarlyDays 
             AND (CASE WHEN WB.RitmoCluster > 0 THEN WB.RitmoActual / WB.RitmoCluster ELSE 1.0 END) < 0.7)
            -- Desaceleración
            OR ((CASE WHEN WB.RitmoBase > 0 THEN WB.RitmoActual / WB.RitmoBase ELSE 1.0 END) < @ThresholdIndiceDesaceleracion
                AND WB.StockTotal > 0
                AND ((CASE WHEN WB.RitmoActual > 0 THEN WB.StockTotal / WB.RitmoActual ELSE 9999 END) > @ThresholdDiasStockAlerta
                     OR (CASE WHEN WB.RitmoCluster > 0 THEN WB.RitmoActual / WB.RitmoCluster ELSE 1.0 END) < 0.8))
            -- Sobrestock
            OR (WB.RitmoActual > 0 
                AND (WB.StockTotal / WB.RitmoActual) > GREATEST(0, @CycleDays - WB.DiasDesdeInicio))
            -- Sin tracción
            OR (WB.Unidades14 = 0 AND WB.StockTotal > 0)
        )
    ORDER BY Score DESC, WB.StockTotal DESC;
END;
GO

PRINT 'Stored Procedure sp_GetPriceActionsWatchlist creado exitosamente';
