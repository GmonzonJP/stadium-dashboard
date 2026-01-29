# Deploy: Nginx Image Proxy

## Problema
Las imágenes están en un servidor interno (`http://10.108.0.19/Imagenes/`) que no es accesible desde internet. Los usuarios externos no pueden ver las imágenes de productos.

## Solución
Configurar nginx en el servidor de stadium (`10.120.0.24`) como proxy inverso para las imágenes.

---

## Pasos de Instalación

### 1. Conectarse al servidor
```bash
ssh aisrvadmin@10.120.0.24
# password: aisrvadmin
```

### 2. Instalar nginx (si no está instalado)
```bash
sudo apt update
sudo apt install nginx -y
```

### 3. Verificar que nginx está corriendo
```bash
sudo systemctl status nginx
```

### 4. Configurar el proxy de imágenes

Editar la configuración de nginx:
```bash
sudo nano /etc/nginx/sites-available/stadium
```

Agregar esta configuración (o crear un nuevo server block):

```nginx
server {
    listen 80;
    server_name _;  # o tu dominio/IP pública

    # Proxy para la app Next.js (PM2)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Proxy para imágenes de productos
    location /images/ {
        proxy_pass http://10.108.0.19/Imagenes/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Cache de imágenes (24 horas)
        proxy_cache_valid 200 24h;
        proxy_cache_valid 404 1m;

        # Timeouts
        proxy_connect_timeout 10s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;

        # Buffering
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 32k;

        # Headers
        add_header Access-Control-Allow-Origin *;
        add_header Cache-Control "public, max-age=86400";
    }
}
```

### 5. Habilitar el sitio y verificar configuración
```bash
# Si creaste un nuevo archivo
sudo ln -s /etc/nginx/sites-available/stadium /etc/nginx/sites-enabled/

# Verificar sintaxis
sudo nginx -t

# Si hay errores, corregirlos antes de continuar
```

### 6. Reiniciar nginx
```bash
sudo systemctl reload nginx
```

### 7. Verificar que funciona
```bash
# Probar desde el servidor
curl -I http://localhost/images/TESTPRODUCT.jpg

# Debería devolver headers del servidor de imágenes o 404 si el producto no existe
```

---

## Verificación desde el cliente

Una vez deployado, las imágenes serán accesibles via:
- **Interno**: `http://10.120.0.24/images/BASECOL.jpg`
- **Externo**: `http://[IP_PUBLICA]/images/BASECOL.jpg`

El código de la app ahora usa `/images/BASECOL.jpg` (ruta relativa) que nginx redirige al servidor interno.

---

## Troubleshooting

### Las imágenes no cargan
1. Verificar que nginx está corriendo: `sudo systemctl status nginx`
2. Verificar logs: `sudo tail -f /var/log/nginx/error.log`
3. Verificar que el servidor de imágenes responde: `curl http://10.108.0.19/Imagenes/`

### Error 502 Bad Gateway
- El servidor de imágenes (`10.108.0.19`) no es accesible desde el servidor stadium
- Verificar conectividad: `ping 10.108.0.19`
- Verificar firewall

### Error 504 Gateway Timeout
- Aumentar timeouts en la configuración de nginx

---

## Archivos modificados en la app

- `src/lib/utils.ts` - Nueva función `getProductImageUrl()`
- `src/app/recompra/page.tsx`
- `src/components/price-actions/WatchlistTable.tsx`
- `src/components/ProductAnalysisTable.tsx`
- `src/app/producto/[id]/page.tsx`
- `src/components/ProductDetail.tsx`

Todas las URLs de imágenes ahora usan `/images/BASECOL.jpg` en lugar de `http://10.108.0.19/Imagenes/BASECOL.jpg`.
