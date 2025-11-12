import * as cds from "@sap/cds";
import { material, production, state } from "srv/types/generalTypes";
const { Material, Production, State, ProductCamera, Installation } =
  cds.entities;

export const order = async (req: cds.Request) => {
  const { id, amount } = req.data;
  // add amount to database
  // trigger background job to simulate order > delivery > add in stock
  const current = await SELECT.from(Material).columns("amountOrderd").where({
    ID: id,
  });
  const currentAmount = current[0].amountOrderd;
  await UPDATE.entity(Material)
    .set({ amountOrderd: currentAmount + amount })
    .where({ ID: id });

  cds.spawn({ every: 15000 /* ms */ }, async (tx) => {
    const result = await SELECT.from(Material)
      .columns("amountOrderd", "amountInStock")
      .where({
        ID: id,
      });
    const amountNew = result[0].amountOrderd;
    let stock = result[0].amountInStock as number;

    if (amountNew > 0) {
      stock = stock + 1;
      await UPDATE.entity(Material)
        .set({ amountOrderd: amountNew - 1 })
        .where({ ID: id });
      await UPDATE.entity(Material)
        .set({ amountInStock: stock })
        .where({ ID: id });
    }
  });
};

export const produce = async (req: cds.Request) => {
  const productId = req.params[0] as cds.__UUID;

  // Haal materialen op voor dit product
  const allMaterials = (await SELECT.from(Material)
    .columns("ID", "amountInStock")
    .where({ product: productId })) as any[];

  // Controleer of er genoeg voorraad is (minstens 2 van elk)
  const enoughStock = allMaterials.every(m => (m.amountInStock || 0) >= 2);

  if (!enoughStock) {
    req.error(404, "Not enough material in stock to produce this camera.");
    return;
  }

  // Verlaag materiaalvoorraad
  for (const m of allMaterials) {
    await UPDATE.entity(Material)
      .set({ amountInStock: m.amountInStock - 2 })
      .where({ ID: m.ID });
  }

  // Start de productie asynchroon, zodat frontend niet blokkeert
  runInBackgroundProduce(productId)
    .then(() => console.log(`Production for ${productId} completed.`))
    .catch(err => console.error("Production failed:", err));

  return { message: "Production started in background." };
};

// ✅ De echte productieflow
async function runInBackgroundProduce(productId: cds.__UUID) {
  // Haal alle production flows op, op volgorde van position
  const flows = (await SELECT.from(Production)
    .orderBy("position")
    .where({ product: productId })) as any[];

  if (!flows.length) {
    console.warn(`No production flows found for product ${productId}`);
    return;
  }

  console.log(`Starting production for product ${productId}...`);

  // Start een interval om elke 10s de status bij te werken
  const intervalId = setInterval(async () => {
    try {
      // Zoek eerste flow met 'Neutral' state > 0
      for (const flow of flows) {
        const [neutralState] = (await SELECT.from(State).where({
          production: flow.ID,
          state: "Neutral",
        })) as any[];

        if (neutralState && neutralState.value > 0) {
          const newValue = Math.max(neutralState.value - 5, 0);

          // Voeg nieuwe 'Positive'-state toe
          await INSERT.into(State).entries({
            state: "Positive",
            value: 5,
            production: flow.ID,
          });

          // Update bestaande 'Neutral'-state
          await UPDATE.entity(State)
            .set({ value: newValue })
            .where({ ID: neutralState.ID });

          console.log(`Progressed flow ${flow.ID} by 5`);
          return; // wacht tot volgende interval
        }
      }

      // Als alle flows klaar zijn (geen Neutral > 0 meer)
      clearInterval(intervalId);

      // Verhoog de productvoorraad met 1
      const [camera] = (await SELECT.from(ProductCamera)
        .columns("amountInStock")
        .where({ ID: productId })) as any[];

      const newAmount = (camera.amountInStock || 0) + 1;

      await UPDATE.entity(ProductCamera)
        .set({ amountInStock: newAmount })
        .where({ ID: productId });

      console.log(`✅ Production completed for product ${productId}`);

    } catch (err) {
      console.error("Error during production flow:", err);
      clearInterval(intervalId);
    }
  }, 10000);
}

export const replaceInstallation = async (req: cds.Request) => {
  try {
    const { id } = req.data;

    // 1️⃣ Haal installatie op
    const [installation] = await SELECT.from(Installation)
      .columns("ID", "product", "status")
      .where({ ID: id });

    if (!installation) {
      req.error(404, "Installation not found.");
      return;
    }

    const productId = installation.product;

    // 2️⃣ Check camera voorraad
    const [camera] = await SELECT.from(ProductCamera)
      .columns("amountInStock")
      .where({ ID: productId });

    if (!camera || camera.amountInStock <= 0) {
      req.error(400, "❌ No cameras in stock to replace this installation.");
      return;
    }

    // 3️⃣ Update installatie status naar "Fine"
    await UPDATE.entity(Installation)
      .set({ status: "Fine" })
      .where({ ID: id });

    // 4️⃣ Verminder voorraad
    await UPDATE.entity(ProductCamera)
      .set({ amountInStock: camera.amountInStock - 1 })
      .where({ ID: productId });

    // 5️⃣ Geef boodschap terug aan UI
    return { message: "🔧 Damaged camera replaced successfully." };
  } catch (err) {
    console.error("replaceInstallation failed:", err);
    req.error(500, "Internal server error during replacement.");
  }
};
