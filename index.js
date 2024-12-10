const { scrapeVolvoModels } = require('./scraper.js');

console.log('Avvio dello script di scraping...');

scrapeVolvoModels()
  .then(results => {
    console.log('\nScript completato con successo!');
  })
  .catch(error => {
    console.error('Errore durante l\'esecuzione:', error);
  });