# Vista Geoespacial 3D - Configuración

Esta guía explica cómo configurar y usar la vista Geoespacial 3D del dashboard.

## Requisitos

- Token de acceso de Mapbox (gratuito para desarrollo)
- Node.js y npm instalados

## Obtener Token de Mapbox

1. **Crear cuenta en Mapbox** (si no tienes una):
   - Visita: https://account.mapbox.com/auth/signup/
   - Crea una cuenta gratuita

2. **Obtener Access Token**:
   - Una vez registrado, ve a: https://account.mapbox.com/access-tokens/
   - Copia tu **Default Public Token** o crea uno nuevo

3. **Configurar en el proyecto**:
   - Crea o edita el archivo `.env.local` en la raíz del proyecto
   - Agrega la siguiente línea:
     ```
     NEXT_PUBLIC_MAPBOX_TOKEN=tu_token_aqui
     ```
   - Reemplaza `tu_token_aqui` con tu token real

4. **Reiniciar servidor de desarrollo**:
   ```bash
   npm run dev
   ```

## Instalación de Dependencias

Las dependencias necesarias ya están instaladas:
- `mapbox-gl`: Librería principal de Mapbox
- `@types/mapbox-gl`: Tipos TypeScript

Si necesitas reinstalarlas:
```bash
npm install mapbox-gl @types/mapbox-gl
```

## Características

### Modo 2D/3D
- **Toggle 2D/3D**: Cambia entre vista plana y vista 3D con terreno
- En modo 3D se activa:
  - Terreno con elevación
  - Sky layer (atmósfera)
  - Pitch (inclinación) de 65 grados

### Modos de Vista
- **Clúster**: Vista general del cluster
- **Empresas**: Enfocado en las empresas
- **Sinergias**: Muestra conexiones entre empresas

### Interacciones
- **Click en marcador**: Vuela a la empresa y muestra panel lateral
- **Scroll**: Zoom in/out
- **Drag**: Pan del mapa
- **Reset Vista**: Vuelve a la vista inicial del cluster

### Conexiones de Sinergias
- Líneas verdes: Sinergias aprobadas
- Líneas amarillas: Sinergias en RFP
- Líneas grises: Sinergias pendientes
- Grosor de línea: Proporcional al volumen/impacto

## Datos

### Fuente de Datos
La vista intenta obtener coordenadas de:
1. Tabla `company_sites` en Supabase (campos `lat`, `lng`)
2. Si no hay datos, usa un dataset mock con las 6 empresas del cluster

### Empresas Incluidas
- Reficar (Ecopetrol)
- Yara Colombia
- Argos - Planta Cartagena
- Ajover S.A.
- Esenttia
- Cabot Colombiana

## Endpoint de Datos

### `/api/data/companies-geo`
Retorna lista de empresas con coordenadas geográficas.

**Formato de respuesta:**
```json
{
  "data": [
    {
      "id": "reficar",
      "name": "Reficar (Ecopetrol)",
      "lat": 10.3139,
      "lng": -75.5114,
      "category": "Refinería",
      "status": "active"
    }
  ]
}
```

## Solución de Problemas

### "Mapbox Token Requerido"
- Verifica que el token esté en `.env.local`
- Asegúrate de que el archivo esté en la raíz del proyecto
- Reinicia el servidor después de agregar el token

### Mapa no se carga
- Verifica la consola del navegador para errores
- Asegúrate de que el token sea válido
- Verifica tu conexión a internet

### Marcadores no aparecen
- Verifica que el endpoint `/api/data/companies-geo` retorne datos
- Revisa la consola para errores de carga

## Límites de Mapbox Free Tier

- **50,000 cargas de mapa por mes**
- Suficiente para desarrollo y pruebas
- Para producción, considera un plan de pago

## Próximas Mejoras

- [ ] Integración completa con datos de Supabase
- [ ] Animaciones de vuelo más suaves
- [ ] Capas adicionales (tráfico, clima, etc.)
- [ ] Exportación de vistas
- [ ] Medición de distancias




