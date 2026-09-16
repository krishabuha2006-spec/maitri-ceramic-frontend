const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;

const inputPath = path.join(__dirname, '..', 'public', 'Maitri-Ceramic-logo.png');
const outputPath = path.join(__dirname, '..', 'public', 'favicon.png');

fs.createReadStream(inputPath)
  .pipe(new PNG({ filterType: 4 }))
  .on('parsed', function() {
    const srcWidth = this.width;
    const srcHeight = this.height;

    // We create a square PNG favicon (e.g. max dimension with padding)
    const size = Math.max(srcWidth, srcHeight) + 30; // square size with padding
    const favicon = new PNG({ width: size, height: size });

    // Fill favicon with clean white background or transparent background
    // Let's make it a clean white background with rounded corners or transparent
    const offsetX = Math.floor((size - srcWidth) / 2);
    const offsetY = Math.floor((size - srcHeight) / 2);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (size * y + x) << 2;
        
        // Fill white background
        favicon.data[idx] = 255;     // R
        favicon.data[idx + 1] = 255; // G
        favicon.data[idx + 2] = 255; // B
        favicon.data[idx + 3] = 255; // A (opaque white)
      }
    }

    // Overlay the logo, converting white text to dark navy (#0f172a)
    for (let y = 0; y < srcHeight; y++) {
      for (let x = 0; x < srcWidth; x++) {
        const srcIdx = (srcWidth * y + x) << 2;
        const alpha = this.data[srcIdx + 3];

        if (alpha > 10) {
          const destX = offsetX + x;
          const destY = offsetY + y;
          const destIdx = (size * destY + destX) << 2;

          // Replace white/light logo pixels with dark navy #0f172a (R:15, G:23, B:42)
          const factor = alpha / 255;
          favicon.data[destIdx] = Math.round(15 * factor + 255 * (1 - factor));
          favicon.data[destIdx + 1] = Math.round(23 * factor + 255 * (1 - factor));
          favicon.data[destIdx + 2] = Math.round(42 * factor + 255 * (1 - factor));
          favicon.data[destIdx + 3] = 255;
        }
      }
    }

    favicon.pack().pipe(fs.createWriteStream(outputPath)).on('finish', () => {
      console.log('Favicon PNG successfully generated at:', outputPath);
    });
  });
