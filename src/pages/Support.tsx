import { useEffect } from "react";

const Support = () => {
  useEffect(() => {
    document.title = "FieldLog Support";
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-16 sm:py-24">
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            FieldLog Support
          </h1>
        </header>

        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
          FieldLog helps construction teams turn voice notes into professional
          daily reports in seconds.
        </p>

        <hr className="my-10 border-border" />

        <section className="space-y-3">
          <p className="text-base font-medium">
            For support or questions, contact:
          </p>
          <p>
            <a
              href="mailto:publicworkschannel@gmail.com"
              className="text-base font-semibold underline underline-offset-4 hover:opacity-70 transition-opacity"
            >
              publicworkschannel@gmail.com
            </a>
          </p>
          <p className="text-sm text-muted-foreground pt-2">
            We typically respond within 24 hours.
          </p>
        </section>
      </div>
    </main>
  );
};

export default Support;
