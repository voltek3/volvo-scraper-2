const puppeteer = require('puppeteer');

async function extractModelData(page) {
  await page.waitForTimeout(1000);
  
  return await page.evaluate(() => {
    const selOptsList = document.querySelector('#selOptsList');
    
    // Estrai i dati finanziari dal riepilogo
    const getFinancialData = (text) => {
      const dls = selOptsList?.querySelectorAll('dl') || [];
      for (const dl of dls) {
        const dt = dl.querySelector('dt');
        if (dt && dt.textContent.trim().includes(text)) {
          const dd = dl.querySelector('dd');
          return dd ? dd.textContent.trim() : 'N/A';
        }
      }
      return 'N/A';
    };

    // Estrai i dati tecnici dalla pagina
    const getTechnicalData = (label) => {
      const dls = document.querySelectorAll('.car_features dl');
      for (const dl of dls) {
        const dt = dl.querySelector('dt');
        if (dt && dt.textContent.trim().includes(label)) {
          const dd = dl.querySelector('dd');
          return dd ? dd.textContent.trim() : 'N/A';
        }
      }
      return 'N/A';
    };

    return {
      // Dati finanziari
      driverCost: getFinancialData('Importo mensile a carico del Driver'),
      monthlyReference: getFinancialData('Costo di Riferimento Mensile'),
      fringeBenefit: getFinancialData('Ammontare fringe benefit'),
      
      // Dati tecnici
      alimentazione: getTechnicalData('Alimentazione'),
      potenza: getTechnicalData('Potenza'),
      emissioniCO2: getTechnicalData('Emissioni di CO'),
      cilindrata: getTechnicalData('Cilindrata'),
      peso: getTechnicalData('Peso')
    };
  });
}

async function extractModelsFromPage(page, marca) {
  await page.waitForTimeout(2000);

  return await page.evaluate((marca) => {
    const modelContainer = document.querySelector('.car-list, .vehicles-list');
    if (!modelContainer) return [];

    return Array.from(modelContainer.querySelectorAll('tr')).map(row => {
      const linkEl = row.querySelector('a[href*="/' + marca.toLowerCase() + '/"]');
      if (!linkEl) return null;

      // Cerca i dati tecnici nella riga
      const cells = Array.from(row.querySelectorAll('td'));
      const getCell = (index) => cells[index]?.textContent.trim() || 'N/A';

      return {
        url: linkEl.href,
        name: marca + ' ' + linkEl.textContent.trim(),
        alimentazione: getCell(3),
        potenza: getCell(4),
        emissioniCO2: getCell(5)
      };
    }).filter(Boolean);
  }, marca);
}

async function scrapeVolvoModels(page) {
  console.log('\nAnalizzando modelli Volvo...');
  await page.goto('https://www.arval-carconfigurator.com/index.jsp?makerId=VOLVO', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  const models = await extractModelsFromPage(page, 'VOLVO');
  console.log(`Trovati ${models.length} modelli Volvo`);
  return models;
}

async function scrapeMercedesModels(page) {
  console.log('\nAnalizzando modelli Mercedes...');
  await page.goto('https://www.arval-carconfigurator.com/index.jsp?makerId=MERCEDES', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  const models = await extractModelsFromPage(page, 'MERCEDES');
  const glcModels = models.filter(model => {
    const text = model.name.toLowerCase();
    return text.includes('glc') && 
           (text.includes('sports utility vehicle') || text.includes('coupè'));
  });

  console.log(`Trovati ${glcModels.length} modelli Mercedes GLC`);
  return glcModels;
}

async function scrapeTeslaModels(page) {
  console.log('\nAnalizzando modelli Tesla...');
  await page.goto('https://www.arval-carconfigurator.com/index.jsp?makerId=TESLA', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  const models = await extractModelsFromPage(page, 'TESLA');
  console.log(`Trovati ${models.length} modelli Tesla`);
  return models;
}

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

    // Raccogli tutti i modelli con i loro dati tecnici dalla lista
    const volvoLinks = await scrapeVolvoModels(page);
    const mercedesLinks = await scrapeMercedesModels(page);
    const teslaLinks = await scrapeTeslaModels(page);

    const allModels = [...volvoLinks, ...mercedesLinks, ...teslaLinks];
    console.log(`\nTrovati in totale ${allModels.length} modelli da analizzare`);

    const results = [];

    // Analizza ogni modello
    for (const model of allModels) {
      console.log(`\nAnalizzando ${model.name}...`);
      await page.goto(model.url, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      const detailData = await extractModelData(page);

      results.push({
        model: model.name,
        alimentazione: model.alimentazione,
        potenza: model.potenza,
        emissioniCO2: model.emissioniCO2,
        ...detailData
      });

      console.log('Dati estratti:', detailData);
      await page.waitForTimeout(500);
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