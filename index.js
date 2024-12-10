const { scrapeAllModels } = require('./scraper.js');

console.log('Avvio dello script di scraping...');

scrapeAllModels()
  .then(results => {
    console.log('\nScript completato con successo!');
  })
  .catch(error => {
    console.error('Errore durante l\'esecuzione:', error);
  });