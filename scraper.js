const puppeteer = require('puppeteer');

async function scrapeAllModels() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });

  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log('Aprendo la pagina di Arval...');
    await page.goto('https://www.arval-carconfigurator.com', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('In attesa del login e selezione km...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    const results = [];

    // Volvo
    console.log('\nAnalizzando modelli Volvo...');
    await page.goto('https://www.arval-carconfigurator.com/index.jsp?makerId=VOLVO', {
      waitUntil: 'networkidle0'
    });
    await page.waitForTimeout(2000);

    const volvoLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/volvo/"]'))
        .map(a => ({
          url: a.href,
          name: 'Volvo ' + a.textContent.trim()
        }));
    });

    // Mercedes
    console.log('\nAnalizzando modelli Mercedes...');
    await page.goto('https://www.arval-carconfigurator.com/index.jsp?makerId=MERCEDES', {
      waitUntil: 'networkidle0'
    });
    await page.waitForTimeout(2000);

    const mercedesLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/mercedes/"]'))
        .filter(a => {
          const text = a.textContent.toLowerCase();
          return text.includes('glc') && 
                 (text.includes('sports utility vehicle') || text.includes('coupè'));
        })
        .map(a => ({
          url: a.href,
          name: 'Mercedes ' + a.textContent.trim()
        }));
    });

    // Tesla
    console.log('\nAnalizzando modelli Tesla...');
    await page.goto('https://www.arval-carconfigurator.com/index.jsp?makerId=TESLA', {
      waitUntil: 'networkidle0'
    });
    await page.waitForTimeout(2000);

    const teslaLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/tesla/"]'))
        .map(a => ({
          url: a.href,
          name: 'Tesla ' + a.textContent.trim()
        }));
    });

    const allModels = [...volvoLinks, ...mercedesLinks, ...teslaLinks];
    console.log(`\nTrovati in totale ${allModels.length} modelli da analizzare`);

    // Analizza ogni modello
    for (const model of allModels) {
      console.log(`\nAnalizzando ${model.name}...`);
      await page.goto(model.url, {
        waitUntil: 'networkidle0'
      });
      await page.waitForTimeout(2000);

      const modelData = await page.evaluate(() => {
        // Dati finanziari dal riepilogo
        const selOptsList = document.querySelector('#selOptsList');
        const getData = (text) => {
          if (!selOptsList) return 'N/A';
          const dls = selOptsList.querySelectorAll('dl');
          for (const dl of dls) {
            const dt = dl.querySelector('dt');
            if (dt && dt.textContent.trim().includes(text)) {
              const dd = dl.querySelector('dd');
              return dd ? dd.textContent.trim() : 'N/A';
            }
          }
          return 'N/A';
        };

        // Dati tecnici dalla pagina
        const getTechnicalData = (text) => {
          const dls = document.querySelectorAll('.car_features dl');
          for (const dl of dls) {
            const dt = dl.querySelector('dt');
            if (dt && dt.textContent.trim().includes(text)) {
              const dd = dl.querySelector('dd');
              return dd ? dd.textContent.trim() : 'N/A';
            }
          }
          return 'N/A';
        };

        return {
          driverCost: getData('Importo mensile a carico del Driver'),
          monthlyReference: getData('Costo di Riferimento Mensile'),
          fringeBenefit: getData('Ammontare fringe benefit'),
          alimentazione: getTechnicalData('Alimentazione'),
          potenza: getTechnicalData('Potenza'),
          co2: getTechnicalData('Emissioni di CO'),
          cilindrata: getTechnicalData('Cilindrata')
        };
      });

      results.push({
        model: model.name,
        ...modelData
      });

      console.log('Dati estratti:', modelData);
      await page.waitForTimeout(1000);
    }

    // Ordina i risultati per costo driver
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

module.exports = { scrapeAllModels };