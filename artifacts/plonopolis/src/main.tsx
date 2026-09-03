import { createRoot } from "react-dom/client";
import App from "./App";
import { installGoogleTranslateDomGuard } from "./googleTranslateGuard";
import "./index.css";

installGoogleTranslateDomGuard();

createRoot(document.getElementById("root")!).render(<App />);
