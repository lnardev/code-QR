# Generador de QR

App vanilla (HTML/CSS/JS) para generar códigos QR de texto o URL. Funciona sin conexión.

## Uso
Abrir `index.html` en el navegador. El QR se genera mientras escribes.

## Funciones
- Generación en vivo (debounce de 150 ms)
- Texto Unicode correcto (UTF-8: tildes, ñ, emojis)
- Nivel de corrección de errores L/M/Q/H
- Tamaño de descarga 256/512/1024 px
- Descargar PNG o SVG, copiar imagen al portapapeles
- Tema dark/light con persistencia

## Estructura
- `index.html`
- `css/styles.css`
- `js/app.js`: DOM y estado (`render()` es el único dueño del estado)
- `js/qr-core.js`: lógica pura (validación por bytes, layout, SVG), testeable en Node
- `js/vendor/qrcode.js`: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 2.0.4 (MIT)
- `test/`: pruebas con `node --test`

## Desarrollo
```
npm ci
npm test
```
