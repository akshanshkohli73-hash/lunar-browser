import React from "react";
import ReactDOM from "react-dom/client";
import CoquetteDesktopShell from "./components/CoquetteDesktopShell";
import "./index.css";
import "./styles/organic.css";
import "./liquid/liquid.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CoquetteDesktopShell />
  </React.StrictMode>,
);
