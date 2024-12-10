const puppeteer = require('puppeteer');
const fs = require('fs');

function saveToCSV(results) {
  // Prepara l'header del CSV
  const headers = ['model', 'driverCost', 'monthlyReference', 'fringeBenefit', 'alimentazione', 'potenza', 'co2', 'cilindrata'];
  
  // Converte i risultati in formato CSV
  const csv = [
    // Header
    headers.join(','),
    // Dati
    ...results.map(row => {
      return headers.map(header => {
        // Gestisce valori con virgole aggiungendo le virgolette
        const value = row[header]?.toString().replace(/"/g, '""') || '';
        return value.includes(',') ? `"${value}"` : value;
      }).join(',');
    })
  ].join('\n');

  // Salva il file
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const filename = `risultati_${timestamp}.csv`;
  fs.writeFileSync(filename, csv);
  console.log(`\nRisultati salvati in: ${filename}`);
  return filename;
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
    console.log(`Trovati ${volvoLinks.length} modelli Volvo`);

    // Mercedes
    console.log('\nAnalizzando modelli Mercedes...');
    await page.goto('https://www.arval-carconfigurator.com/index.jsp?makerId=MERCEDES', {
      waitUntil: 'networkidle0'
    });
    await page.waitForTimeout(3000);

    const mercedesLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('.table-modelli').forEach(table => {
        if (table.id && table.id.toLowerCase().includes('glc')) {
          table.querySelectorAll('tbody tr').forEach(tr => {
            const firstCell = tr.querySelector('td');
            if (firstCell) {
              const link = firstCell.querySelector('a');
              if (link && link.href && link.href.includes('/mercedes/')) {
                links.push({
                  url: link.href,
                  name: 'Mercedes ' + link.textContent.trim()
                });
              }
            }
          });
        }
      });
      return links;
    });
    console.log(`Trovati ${mercedesLinks.length} modelli Mercedes GLC`);
    
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
    console.log(`Trovati ${teslaLinks.length} modelli Tesla`);

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

    // Salva i risultati in un file CSV
    const filename = saveToCSV(sortedResults);
    console.log(`\nPuoi aprire ${filename} con Excel o Google Sheets`);

    return sortedResults;

  } catch (error) {
    console.error('Errore durante lo scraping:', error);
  } finally {
    await browser.close();
  }
}

module.exports = { scrapeAllModels };