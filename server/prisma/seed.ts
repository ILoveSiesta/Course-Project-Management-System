// Reproducible synthetic demo data.
// Seed records (teams, memberships, supervisors, demo accounts) are added
// together with the models they depend on. Never seed real passwords or personal data.
async function main() {
  console.log("Seed: no models defined yet - nothing to seed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
