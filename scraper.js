const puppeteer = require('puppeteer');

async function extractModelData(page) {
  await page.waitForTimeout(1000);
  
  return await page.evaluate(() => {
    const selOptsList = document.querySelector('#selOptsList');
    if (!selOptsList) return {
      driverCost: 'N/A',
      monthlyReference: 'N/A',
      fringeBenefit: 'N/A'
    };

    const getData = (text) => {
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

    return {
      driverCost: getData('Importo mensile a carico del Driver'),
      monthlyReference: getData('Costo di Riferimento Mensile'),
      fringeBenefit: getData('Ammontare fringe benefit')
    };
  });
}

async function scrapeVolvoModels(page) {
  console.log('\nAnalizzando modelli Volvo...');
  await page.goto('https://www.arval-carconfigurator.com/index.jsp?makerId=VOLVO', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  await page.waitForTimeout(2000);

  const modelLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/volvo/"]'))
      .map(a => ({
        url: a.href,
        name: 'Volvo ' + a.textContent.trim()
      }));
  });

  console.log(`Trovati ${modelLinks.length} modelli Volvo`);
  return modelLinks;
}

async function scrapeMercedesModels(page) {
  console.log('\nAnalizzando modelli Mercedes...');
  await page.goto('https://www.arval-carconfigurator.com/index.jsp?makerId=MERCEDES', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  await page.waitForTimeout(2000);

  const modelLinks = await page.evaluate(() => {
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

  console.log(`Trovati ${modelLinks.length} modelli Mercedes GLC`);
  return modelLinks;
}

async function scrapeTeslaModels(page) {
  console.log('\nAnalizzando modelli Tesla...');
  await page.goto('https://www.arval-carconfigurator.com/index.jsp?makerId=TESLA', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  await page.waitForTimeout(2000);

  const modelLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/tesla/"]'))
      .map(a => ({
        url: a.href,
        name: 'Tesla ' + a.textContent.trim()
      }));
  });

  console.log(`Trovati ${modelLinks.length} modelli Tesla`);
  return modelLinks;
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

    // Raccogli tutti i modelli
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

      const modelData = await extractModelData(page);

      results.push({
        model: model.name,
        ...modelData
      });

      console.log('Dati estratti:', modelData);
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