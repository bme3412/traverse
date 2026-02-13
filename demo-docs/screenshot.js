/**
 * Screenshot HTML templates to PNG images for demo
 * Usage: node screenshot.js
 */

const fs = require('fs');
const path = require('path');

async function captureScreenshots() {
  // Check if puppeteer is available
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (error) {
    console.error('❌ Puppeteer not found. Installing...');
    console.log('Please run: npm install puppeteer');
    process.exit(1);
  }

  const templatesDir = path.join(__dirname, 'templates');
  const outputDir = path.join(__dirname, 'images');

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Get all HTML files
  const htmlFiles = fs.readdirSync(templatesDir)
    .filter(file => file.endsWith('.html'))
    .sort();

  console.log(`📸 Found ${htmlFiles.length} HTML files to screenshot\n`);

  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  for (const htmlFile of htmlFiles) {
    const htmlPath = path.join(templatesDir, htmlFile);
    const pngFile = htmlFile.replace('.html', '.png');
    const pngPath = path.join(outputDir, pngFile);

    console.log(`Processing: ${htmlFile}`);

    try {
      const page = await browser.newPage();

      // Set viewport for consistent screenshots
      await page.setViewport({
        width: 1200,
        height: 1600,
        deviceScaleFactor: 2 // High DPI for clarity
      });

      // Load HTML file
      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0'
      });

      // Wait for fonts to load
      await page.evaluateHandle('document.fonts.ready');

      // Take screenshot
      await page.screenshot({
        path: pngPath,
        type: 'png',
        fullPage: true
      });

      console.log(`  ✅ Saved: ${pngFile}\n`);

      await page.close();
    } catch (error) {
      console.error(`  ❌ Error processing ${htmlFile}:`, error.message);
    }
  }

  await browser.close();
  console.log('🎉 All screenshots captured successfully!');
}

// Run
captureScreenshots().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
