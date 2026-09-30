export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-6 pb-12">
      <div className="glass-card flex flex-col items-center gap-2 px-6 py-6 text-center">
        <p className="text-sm font-medium text-frost">BioStream</p>
        <p className="max-w-xl text-xs leading-relaxed text-mist/80">
          Built for the Global Innovation Build Challenge. Research preview — aggregations of
          public annotations are not clinical interpretation. All upstream data via UniProtKB,
          Ensembl, InterPro, AlphaFold DB, AlphaMissense and Ensembl VEP.
        </p>
      </div>
    </footer>
  );
}
