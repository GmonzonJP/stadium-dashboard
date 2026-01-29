-- Tabla de usuarios para autenticación
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Usuarios]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Usuarios] (
        [Id] INT IDENTITY(1,1) PRIMARY KEY,
        [Usuario] NVARCHAR(50) NOT NULL UNIQUE,
        [Email] NVARCHAR(100) NULL,
        [PasswordHash] NVARCHAR(255) NOT NULL,
        [Nombre] NVARCHAR(100) NULL,
        [Rol] NVARCHAR(20) NOT NULL DEFAULT 'usuario', -- 'admin', 'usuario', 'viewer'
        [Activo] BIT NOT NULL DEFAULT 1,
        [FechaCreacion] DATETIME NOT NULL DEFAULT GETDATE(),
        [UltimoAcceso] DATETIME NULL,
        [RecordarSesion] BIT NOT NULL DEFAULT 0
    );
    
    -- Índice para búsqueda rápida por usuario
    CREATE INDEX IX_Usuarios_Usuario ON [dbo].[Usuarios]([Usuario]);
    
    -- Usuario admin por defecto (password: admin123 - cambiar después del primer login)
    -- Hash generado con bcrypt para 'admin123'
    INSERT INTO [dbo].[Usuarios] ([Usuario], [Email], [PasswordHash], [Nombre], [Rol], [Activo])
    VALUES ('admin', 'admin@stadium.com', '$2b$10$XrWAMVJXLGxdjIHWeSZq4OSMjbYdqrgqNJGC/jucNu0pQEQxKfOOi', 'Administrador', 'admin', 1);
    
    PRINT 'Tabla Usuarios creada exitosamente';
END
ELSE
BEGIN
    PRINT 'La tabla Usuarios ya existe';
END
