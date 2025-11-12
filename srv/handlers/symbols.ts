import * as cds from "@sap/cds";
const { Symbol, SymbolTranslation } = cds.entities;

export const translate = async (req: cds.Request) => {
  // Get all SymbolTranslation records to create a lookup map
  // This is more efficient than querying the DB for each symbol
  const translations = await SELECT.from(SymbolTranslation);
  const translationMap = new Map<string, string>();
  for (const t of translations) {
    const key = `${t.language}_${t.symbol}`;
    translationMap.set(key, t.translation);
  }

  // Use Promise.all to handle all translations concurrently
  await Promise.all(req.params.map(async (id) => {
    const record = await SELECT.one.from(Symbol).where({ ID: id });

    if (record && record.symbol && record.language) {
      // Split the symbol string into individual symbols. Based on the CSV, they are space-separated.
      const symbolsToTranslate = record.symbol.split(' ');

      const translatedWords = symbolsToTranslate.map((s: string) => {
        const key = `${record.language}_${s}`;
        // Find the translation in the map, or return a placeholder if not found
        return translationMap.get(key) || `[${s}]`;
      });

      const finalTranslation = translatedWords.join(' ');

      // Update the Symbol record with the full translation
      await UPDATE(Symbol, id).with({ translation: finalTranslation });
    }
  }));
};