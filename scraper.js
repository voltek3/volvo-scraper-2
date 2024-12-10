const puppeteer = require('puppeteer');

async function scrapeVolvoModels() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('Navigando alla pagina Volvo...');
    await page.goto('https://www.arval-carconfigurator.com/index.jsp?makerId=VOLVO', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('Cercando i modelli disponibili...');
    await page.waitForSelector('a[href*="/volvo/"]');

    const modelLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/volvo/"]'))
        .map(a => ({
          url: a.href,
          name: a.textContent.trim()
        }));
    });

    console.log(`Trovati ${modelLinks.length} modelli da analizzare`);
    const results = [];

    for (const model of modelLinks) {
      console.log(`\nAnalizzando ${model.name}...`);
      await page.goto(model.url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      const modelData = await page.evaluate(() => {
        const getData = (text) => {
          const el = Array.from(document.querySelectorAll('tr')).find(row => 
            row.textContent.includes(text)
          );
          return el ? el.querySelector('td:last-child').textContent.trim() : 'N/A';
        };

        return {
          driverCost: getData('Importo mensile a carico del Driver'),
          monthlyReference: getData('Costo di Riferimento Mensile'),
          fringeBenefit: getData('Ammontare fringe benefit')
        };
      });

      results.push({
        model: model.name,
        ...modelData
      });

      console.log('Dati estratti:', modelData);
      await page.waitForTimeout(2000);
    }

    const sortedResults = results.sort((a, b) => {
      const costA = parseFloat(a.driverCost.replace('€', '').replace('.', '').replace(',', '.'));
      const costB = parseFloat(b.driverCost.replace('€', '').replace('.', '').replace(',', '.'));
      return costA - costB;
    });

    console.log('\nAnalisi completata! Ecco i risultati ordinati per costo driver:');
    console.table(sortedResults);

    return sortedResults;

  } catch (error) {
    console.error('Errore durante lo scraping:', error);
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeVolvoModels };