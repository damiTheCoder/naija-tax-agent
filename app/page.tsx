import Image from "next/image";
import { APP_LOGO_ALT, APP_LOGO_SRC } from "@/lib/constants";
import LandingAuthButtons from "./LandingAuthButtons";

export default function LandingPage() {
  return (
    <main className="single-landing-page">
      <Image
        src="/L1.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="single-landing-bg"
        aria-hidden="true"
      />
      <div className="single-landing-scrim" aria-hidden="true" />

      <section className="single-landing-content" aria-labelledby="landing-title">
        <div className="single-landing-brand">
          <span className="single-landing-logo">
            <Image src={APP_LOGO_SRC} alt={APP_LOGO_ALT} fill className="object-contain" sizes="56px" priority />
          </span>
          <span>Bace</span>
        </div>

        <div className="single-landing-copy">
          <h1 id="landing-title">Your Business Finances, Simplified.</h1>
          <p>Know your numbers. Control your cash. Run your business with confidence.</p>
        </div>

        <LandingAuthButtons />

        <p className="single-landing-terms">
          By continuing you accept Bace&apos;s <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
        </p>
      </section>
    </main>
  );
}
