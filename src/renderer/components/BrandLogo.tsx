import brandLogo from "../../../build/icon.png";

/** The single source for the Dashboard mark used inside the renderer. */
export default function BrandLogo() {
  return <img className="brand-logo" src={brandLogo} alt="" aria-hidden="true" />;
}
